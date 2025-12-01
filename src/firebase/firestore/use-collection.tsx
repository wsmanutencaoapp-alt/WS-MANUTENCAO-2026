'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  getDocs,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type WithDocId<T> = T & { docId: string };

export interface UseCollectionOptions {
  queryKey?: any[];
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
  try {
    const snapshot = await getDocs(query);
    const results: WithDocId<T>[] = [];
    snapshot.forEach(doc => {
      results.push({ ...(doc.data() as T), docId: doc.id });
    });
    return results;
  } catch (error) {
    if (error instanceof FirestoreError) {
      const path = query.type === 'collection' ? (query as CollectionReference).path : (query as unknown as InternalQuery)._query.path.canonicalString();
      const contextualError = new FirestorePermissionError({
        operation: 'list',
        path,
      });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError; // Re-throw the rich error for react-query
    }
    throw error; // Re-throw other errors
  }
}


export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
    options: UseCollectionOptions = {}
): UseCollectionResult<T> {
  const queryClient = useQueryClient();
  const queryKey = options.queryKey || (memoizedTargetRefOrQuery ? [(memoizedTargetRefOrQuery as any)._query?.path.toString()] : []);

  const { data, isLoading, error } = useQuery<WithDocId<T>[], Error>({
    queryKey,
    queryFn: () => {
      if (!memoizedTargetRefOrQuery) {
        return Promise.resolve([]);
      }
      return fetchCollection<T>(memoizedTargetRefOrQuery);
    },
    enabled: !!memoizedTargetRefOrQuery,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      return;
    }

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        // When a real-time update comes in, invalidate the query
        // to trigger a refetch, or update the cache directly.
        queryClient.invalidateQueries({ queryKey });
      },
      (err: FirestoreError) => {
        const path = memoizedTargetRefOrQuery.type === 'collection'
            ? (memoizedTargetRefOrQuery as CollectionReference).path
            : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();
        const contextualError = new FirestorePermissionError({ operation: 'list', path });
        errorEmitter.emit('permission-error', contextualError);
        // Optionally, you can also update the query's error state in react-query
        queryClient.setQueryData(queryKey, (oldData: any) => ({ ...oldData, error: contextualError }));
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery, queryClient, queryKey]);

  if (memoizedTargetRefOrQuery && !(memoizedTargetRefOrQuery as any).__memo) {
      console.warn('useCollection was called without a memoized query. This can lead to infinite loops. Use useMemoFirebase to memoize your query.', memoizedTargetRefOrQuery);
  }

  return { data, isLoading, error: error as FirestoreError | Error | null };
}
