import { getDB } from "./init";
import { format } from "./utils";
import {
  Query as FirestoreQuery,
  QuerySnapshot,
  DocumentSnapshot,
  DocumentData,
} from 'firebase-admin/firestore';

// these are the operators allowed to be used in Firestore queries
type Operator = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';

// the condition type to be used when querying Firestore with .where() method
type Condition = {
  field: string;
  operator: Operator;
  value: any;
}

// the order by type to be used in Firestore queries
type OrderBy = {
  field: string
  direction: 'asc' | 'desc'
};

interface FormattingOptions {
  skipFormatting?: boolean;
}

/**
 * Query class used for building queries
 *
 * @class Query
 */
class Query {
  private readonly collection: string;
  private conditions: Condition[] = [];
  private orderField?: OrderBy;
  private limitTo?: number;
  private limitFrom?: number;
  private startItem?: DocumentSnapshot;
  private endItem?: DocumentSnapshot;
  private offsetTo?: number;

  constructor(collection: string) {
    this.collection = collection;
  }

  /**
   * Creates a new Query with the additional filter that documents must contain the specified field and that its value should satisfy the constraint provided.
   * 
   * Returns a new (immutable) instance of the Query (rather than modify the existing instance) to impose the filter.
   *
   * @param {string} field  The path to compare
   * @param {Operator} operator  The operation string (e.g "<", "<=", "==", ">", ">=")
   * @param {*} value  The value for comparison
   * @return {*}  A new Query
   * @memberof Query
   */
  where(field: string, operator: Operator, value: any): Query {
    this.conditions.push({ field, operator, value });
    return this;
  }
  
  /**
   * Creates a new Query that's additionally sorted by the specified field, optionally in descending order instead of ascending.
   * 
   * Returns a new (immutable) instance of the Query (rather than modify the existing instance) to impose the order.
   *
   * @param {string} field  The field to sort by
   * @param {('asc' | 'desc')} direction  Optional direction to sort by ('asc' or 'desc'). If not specified, order will be ascending.
   * @return {*}  A new Query
   * @memberof Query
   */
  orderBy(field: string, direction: 'asc' | 'desc'): Query {
    this.orderField = { field, direction };
    return this;
  }

  /**
   * Creates a new Query that only returns the first matching documents.
   * 
   * Returns a new (immutable) instance of the Query (rather than modify the existing instance) to impose the limit.
   *
   * @param {number} limit  Max number of items to return
   * @return {*}  A new Query
   * @memberof Query
   */
  limit(limit: number): Query {
    this.limitTo = limit;
    return this;
  }

  /**
   * Creates a new Query that only returns the last matching documents.
   * 
   * Must specify at least one orderBy clause for limitToLast queries, otherwise an exception will be thrown during execution.
   *
   * @param {number} limit  Max number of items to return
   * @return {*}  A new Query
   * @memberof Query
   */
  limitToLast(limit: number): Query {
    this.limitFrom = limit;
    return this;
  }

  /**
   * Creates a new Query that starts after the provided document (exclusive). 
   * 
   * The starting position is relative to the order of the query. 
   * 
   * The document must contain all of the fields provided in the orderBy of this query.
   *
   * @param {DocumentSnapshot} startAfter  The snapshot of the document to start after
   * @return {*}  A new Query
   * @memberof Query
   */
  startAfter(startAfter: DocumentSnapshot): Query {
    this.startItem = startAfter;
    return this;
  }

  /**
   * Creates a new Query that ends before the provided document (exclusive). 
   * 
   * The end position is relative to the order of the query. 
   * 
   * The document must contain all of the fields provided in the orderBy of this query.
   *
   * @param {DocumentSnapshot} endBefore  The snapshot of the document to end before
   * @return {*}  A new Query
   * @memberof Query
   */
  endBefore(endBefore: DocumentSnapshot): Query {
    this.endItem = endBefore;
    return this;
  }

  /**
   * Specifies the offset of the returned results.
   * 
   * Returns a new (immutable) instance of the Query (rather than modify the existing instance) to impose the offset.
   *
   * @param {number} offset  The offset to apply to the Query results
   * @return {*}  A new Query
   * @memberof Query
   */
  offset(offset: number): Query {
    this.offsetTo = offset;
    return this;
  }

  /**
   * Execute the query and return fetched documents
   *
   * @param {FormattingOptions} [options]  Formatting options object
   * @return {*}  A Promise that resolves with the results of the Query
   * @memberof Query
   */
  async get(options?: FormattingOptions): Promise<QuerySnapshot<DocumentData> | (DocumentData | null)[]> {
    let firestoreQuery: FirestoreQuery<DocumentData> = getDB().collection(this.collection);

    if (this.conditions.length > 0) {
      this.conditions.forEach(condition => {
        firestoreQuery = firestoreQuery
          .where(condition.field, condition.operator, condition.value);
      });
    }

    if (this.orderField !== undefined) {
      firestoreQuery = firestoreQuery
        .orderBy(this.orderField.field, this.orderField?.direction);
    }

    if (this.limitTo !== undefined) {
      firestoreQuery = firestoreQuery.limit(this.limitTo);
    }

    if (this.limitFrom !== undefined) {
      firestoreQuery = firestoreQuery.limitToLast(this.limitFrom);
    }

    if (this.startItem) {
      firestoreQuery = firestoreQuery.startAfter(this.startItem);
    }

    if (this.endItem) {
      firestoreQuery = firestoreQuery.endBefore(this.endItem);
    }

    if (this.offsetTo !== undefined) {
      firestoreQuery = firestoreQuery.offset(this.offsetTo);
    }

    const data = await firestoreQuery.get();

    return (options && options.skipFormatting) ? data : data.docs.map(doc => format(doc));
  }

  /**
   * Returns a query that counts the documents in the result set of this query.
   * 
   * The returned query, when executed, counts the documents in the result set of this query without actually downloading the documents.
   * 
   * Using the returned query to count the documents is efficient because only the final count, not the documents' data, is downloaded. The returned query can even count the documents if the result set would be prohibitively large to download entirely (e.g. thousands of documents).
   *
   * @return {*}  A Promise that resolves with the number of documents matching the query
   * @memberof Query
   */
  async count(): Promise<number> {
    let firestoreQuery: FirestoreQuery<DocumentData> = getDB().collection(this.collection);

    if (this.conditions.length > 0) {
      this.conditions.forEach(condition => {
        firestoreQuery = firestoreQuery
          .where(condition.field, condition.operator, condition.value);
      });
    }

    if (this.orderField !== undefined) {
      firestoreQuery = firestoreQuery
        .orderBy(this.orderField.field, this.orderField?.direction);
    }

    if (this.startItem) {
      firestoreQuery = firestoreQuery.startAfter(this.startItem);
    }

    if (this.endItem) {
      firestoreQuery = firestoreQuery.endBefore(this.endItem);
    }

    if (this.offsetTo !== undefined) {
      firestoreQuery = firestoreQuery.offset(this.offsetTo);
    }

    const counted = await firestoreQuery.count().get();

    return counted.data().count;
  }
}

export default Query;