'use client';
    
import { useEffect, useMemo } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
  getDoc,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WithDocId } from './use-collection';

/**
 * Interface for useDoc options.
 */
export interface UseDocOptions {
  queryKey?: any[];
  enabled?: boolean;
}


/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithDocId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

async function fetchDoc<T>(docRef: DocumentReference<DocumentData>): Promise<WithDocId<T> | null> {
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return { ...(snapshot.data() as T), docId: snapshot.id };
    }
    return null;
}


/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedDocRef or BAD THINGS WILL HAPPEN
 * use useMemoFirebase to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  options: UseDocOptions = {}
): UseDocResult<T> {
  const queryClient = useQueryClient();
  const { enabled = true } = options;

  const queryKey = options.queryKey || (memoizedDocRef ? [memoizedDocRef.path] : []);

  const { data, isLoading, error } = useQuery<WithDocId<T> | null, Error>({
      queryKey: queryKey,
      queryFn: () => {
          if (!memoizedDocRef) return Promise.resolve(null);
          return fetchDoc<T>(memoizedDocRef);
      },
      enabled: !!memoizedDocRef && enabled,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!memoizedDocRef || !enabled) {
      return;
    }

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          queryClient.setQueryData(queryKey, { ...(snapshot.data() as T), docId: snapshot.id });
        } else {
          queryClient.setQueryData(queryKey, null);
        }
      },
      (err: FirestoreError) => {
        console.error(`Error in useDoc snapshot listener for path: ${memoizedDocRef.path}`, err);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, queryClient, queryKey, enabled]);


  return { data: data ?? null, isLoading, error: error as FirestoreError | Error | null };
}
