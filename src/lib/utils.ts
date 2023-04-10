import { DocumentSnapshot, DocumentData } from 'firebase-admin/firestore';

const format = (doc: DocumentSnapshot<DocumentData>): DocumentData | null => {
  if (!doc.exists) {
    return null;
  }

  return { id: doc.id, ...doc.data() };
};

export { format };