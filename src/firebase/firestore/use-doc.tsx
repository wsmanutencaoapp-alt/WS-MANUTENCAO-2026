'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
  getDoc,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: T | null; // Document data, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  queryClient: ReturnType<typeof useQueryClient>;
}

async function fetchDoc<T>(docRef: DocumentReference<DocumentData>): Promise<T | null> {
    try {
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return snapshot.data() as T;
        }
        return null;
    } catch (error) {
        if (error instanceof FirestoreError) {
            const contextualError = new FirestorePermissionError({
                operation: 'get',
                path: docRef.path,
            });
            errorEmitter.emit('permission-error', contextualError);
            throw contextualError;
        }
        throw error;
    }
}


/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
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
): UseDocResult<T> {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => (memoizedDocRef ? [memoizedDocRef.path] : []), [memoizedDocRef]);

  const { data, isLoading, error } = useQuery<T | null, Error>({
      queryKey: queryKey,
      queryFn: () => {
          if (!memoizedDocRef) return Promise.resolve(null);
          return fetchDoc<T>(memoizedDocRef);
      },
      enabled: !!memoizedDocRef,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!memoizedDocRef) {
      return;
    }

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          queryClient.setQueryData(queryKey, snapshot.data() as T);
        } else {
          queryClient.setQueryData(queryKey, null);
        }
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
        queryClient.setQueryData(queryKey, (oldData: any) => ({ ...oldData, error: contextualError }));
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, queryClient, queryKey]);


  return { data: data ?? null, isLoading, error: error as FirestoreError | Error | null, queryClient };
}
