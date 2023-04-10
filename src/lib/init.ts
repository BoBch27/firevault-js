import { Firestore } from 'firebase-admin/firestore';

let projectFirestore: Firestore;

/**
 * A Function to initalise Firevault using a Firestore service
 *
 * @param {Firestore} firestoreService - Firestore service
 */
const initDB = (firestoreService: Firestore): void => {
  projectFirestore = firestoreService
};

/**
 * A Function to retrieve currect Firestore service
 *
 * @return {*} Firestore service
 */
const getDB = (): Firestore => projectFirestore;

export { initDB, getDB };