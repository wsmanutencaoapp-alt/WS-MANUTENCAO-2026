'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  getDocs,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type WithDocId<T> = T & { docId: string };

export interface UseCollectionOptions {
  queryKey?: any[];
  enabled?: boolean; // Add enabled option
}

export interface UseCollectionResult<T> {
  data: WithDocId<T>[] | undefined; 
  isLoading: boolean;       
  error: FirestoreError | Error | null; 
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

async function fetchCollection<T>(query: CollectionReference<DocumentData> | Query<DocumentData>): Promise<WithDocId<T>[]> {
    const snapshot = await getDocs(query);
    const results: WithDocId<T>[] = [];
    snapshot.forEach(doc => {
      results.push({ ...(doc.data() as T), docId: doc.id });
    });
    return results;
}


export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    options: UseCollectionOptions = {}
): UseCollectionResult<T> {
  const queryClient = useQueryClient();
  const { enabled = true, ...restOptions } = options;

  const path = useMemo(() => 
    memoizedTargetRefOrQuery ? (memoizedTargetRefOrQuery as any)._query?.path.toString() : undefined, 
    [memoizedTargetRefOrQuery]
  );
  
  const queryKey = useMemo(() => {
    return restOptions.queryKey || (path ? [path] : []);
  }, [restOptions.queryKey, path]);

  const { data, isLoading, error } = useQuery<WithDocId<T>[], Error>({
    queryKey,
    queryFn: () => {
      if (!memoizedTargetRefOrQuery) {
        return Promise.resolve([]);
      }
      return fetchCollection<T>(memoizedTargetRefOrQuery);
    },
    enabled: !!memoizedTargetRefOrQuery && enabled, // Control query execution
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!memoizedTargetRefOrQuery || !enabled) {
      return;
    }

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithDocId<T>[] = [];
        snapshot.forEach(doc => {
            results.push({ ...(doc.data() as T), docId: doc.id });
        });
        // Directly update the query cache instead of invalidating
        queryClient.setQueryData(queryKey, results);
      },
      (err: FirestoreError) => {
        const errorPath = memoizedTargetRefOrQuery.type === 'collection'
            ? (memoizedTargetRefOrQuery as CollectionReference).path
            : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();
        console.error(`Error in useCollection snapshot listener for path: ${errorPath}`, err);
      }
    );

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [memoizedTargetRefOrQuery, queryClient, queryKey, enabled]);

  if (memoizedTargetRefOrQuery && !(memoizedTargetRefOrQuery as any).__memo) {
      console.warn('useCollection was called without a memoized query. This can lead to infinite loops. Use useMemoFirebase to memoize your query.', memoizedTargetRefOrQuery);
  }

  return { data, isLoading, error: error as FirestoreError | Error | null };
}
