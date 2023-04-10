import { getDB } from "./init";
import Schema from "./schema";
import Query from "./query";
import { format } from "./utils";
import { DocumentData } from 'firebase-admin/firestore';

interface ValidationOptions {
  skipStrip?: boolean;
  skipRequired?: boolean;
  skipDefault?: boolean;
  allowDotNotation?: boolean;
}

interface ValidatingOptions {
  skipValidation?: boolean;
  skipStrip?: boolean;
}

interface FormattingOptions {
  skipFormatting?: boolean;
}

interface CreationOptions {
  id?: string;
  skipValidation?: boolean;
  skipFormatting?: boolean;
  skipStrip?: boolean;
}

/**
 * A Model is a class that's the primary tool for interacting with Firestore
 *
 * @class Model
 */
class Model<T extends DocumentData> {
  private readonly collection: string;
  private readonly schema: Schema<T>;

  constructor(collection: string, schema: Schema<T>) {
    this.collection = collection;
    this.schema = schema;
  }
  
  /**
   * Validate a data object against the defined Schema
   *
   * @param {T} data  Data object to validate
   * @param {ValidationOptions} [options]  Validation options object
   * @return {*}  A Promise that resolves with the validated data
   * @memberof Model
   */
  async validate(data: T, options?: ValidationOptions): Promise<T> {
    const validatedData = await this.schema.validate(data, undefined, { 
      skipStrip: (options?.skipStrip === undefined) ? false : options?.skipStrip,
      skipDefault: (options?.skipDefault === undefined) ? true : options?.skipDefault, 
      skipRequired: (options?.skipRequired === undefined) ? true : options?.skipRequired,
      allowDotNotation: (options?.allowDotNotation === undefined) ? true : options?.allowDotNotation
    });
    
    return validatedData;
  }

  /**
   * Create a new document
   *
   * @param {T} data  Data object to validate and add to Firestore
   * @param {CreationOptions} [options]  Creation options object
   * @return {*}  A Promise that resolves with the created document
   * @memberof Model
   */
  async create(data: T, options?: CreationOptions): Promise<DocumentData> {
    if (!options || !options.skipValidation) {
      data = await this.schema.validate(data, undefined, {
        skipStrip: (options?.skipStrip === undefined) ? false : options.skipStrip
      });
    }

    if (this.schema.methods?.beforeSave) {
      await this.schema.methods?.beforeSave(data);
    }

    if (options && options.id) {
      const doc = getDB().collection(this.collection).doc(options.id);
      await doc.set(data);
      return (options && options.skipFormatting) ? doc : { id: options.id, ...data };
    }

    const doc = await getDB().collection(this.collection).add(data);
    return (options && options.skipFormatting) ? doc : { id: doc.id, ...data };
  }

  /**
   * Find a document using its ID
   *
   * @param {string} id  ID of document to fetch
   * @param {FormattingOptions} [options]  Formatting options object
   * @return {*}  A Promise that resolves with the document data
   * @memberof Model
   */
  async findById(id: string, options?: FormattingOptions): Promise<DocumentData | null> {
    const doc = await getDB().collection(this.collection).doc(id).get();
    return (options && options.skipFormatting) ? doc : format(doc);
  }

  /**
   * Initiate a new Query
   *
   * @return {*}  A new Query
   * @memberof Model
   */
  find(): Query {
    return new Query(this.collection);
  }

  /**
   * Update a document, using its ID
   *
   * @param {string} id  ID of document to update
   * @param {T} data  Data object to validate and add to Firestore
   * @param {ValidatingOptions} [options]  Validating options object
   * @return {*}  A Promise that resolves with the document ID
   * @memberof Model
   */
  async updateById(id: string, data: T, options?: ValidatingOptions): Promise<string> {
    if (!options || !options.skipValidation) {
      data = await this.schema.validate(data, undefined, { 
        skipStrip: (options?.skipStrip === undefined) ? false : options?.skipStrip,
        skipDefault: true, 
        skipRequired: true,
        allowDotNotation: true
      });
    }

    if (this.schema.methods?.beforeSave) {
      await this.schema.methods?.beforeSave(data);
    }

    await getDB().collection(this.collection).doc(id).update(data);
    return id;
  }

  /**
   * Delete a document, using its ID
   *
   * @param {string} id  ID of document to delete
   * @return {*}  A Promise that resolves with the deleted document ID
   * @memberof Model
   */
  async deleteById(id: string): Promise<string> {
    await getDB().collection(this.collection).doc(id).delete();
    return id;
  }
};

export default Model;