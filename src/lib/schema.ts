import SchemaTypes from "./schema-types";
import { DocumentData } from 'firebase-admin/firestore';

interface SchemaDefiniton {
  [field: string]: {
    type: string;
    required?: boolean | [boolean, string];
    maxLength?: number | [number, string];
    minLength?: number | [number, string];
    validate?: ((value: any) => boolean) | [(value: any) => boolean, string];
    transform?: (value: any) => any;
    default?: () => any;
    arrayOf?: string;
    schema?: SchemaDefiniton;
  }
}

interface Methods<T> {
  beforeSave?: (data: T) => Promise<void>;
}

interface ValidationOptions {
  skipStrip?: boolean;
  skipRequired?: boolean;
  skipDefault?: boolean;
  allowDotNotation?: boolean;
}

/**
 * A Schema object to be used for validating Firestore data
 *
 * @class Schema
 */
class Schema<T extends DocumentData> {
  private readonly definition: SchemaDefiniton;
  readonly methods?: Methods<T>;

  constructor(schemaDefiniton: SchemaDefiniton, methods?: Methods<T>) {7
    this.definition = schemaDefiniton;

    if (methods) {
      this.methods = methods;
    }
  }

  private stripData(data: T, schema: SchemaDefiniton): void {
    for (const key in data) {
      if (schema[key] !== undefined) {
        delete data[key];
      }
    }
  }

  private nestData(data: T): T {
    const nestedObj: { [key: string]: any } = {};

    for (const key in data) {
      const keys = key.split(".");
      let objRef = nestedObj;

      for (let i = 0; i < keys.length - 1; i++) {
        if (objRef[keys[i]] === undefined) {
          objRef[keys[i]] = {};
        }
        
        objRef = objRef[keys[i]];
      }

      objRef[keys[keys.length - 1]] = data[key];
    }

    return nestedObj as T;
  }

  private flattenData(data: T, prefix: string = ''): T {
    const result: { [key: string]: any }  = {};

    Object.entries(data).forEach(([key, value]) => {

      if (typeof value == "object" && value !== undefined && value !== null && 
        !(value instanceof  Date) && 
        !Array.isArray(value) && !(value instanceof RegExp)) {
        Object.assign(result, this.flattenData(value, `${prefix}${key}.`));
      } else {
        result[`${prefix}${key}`] = value;
      }
    });

    return result as T;
  }

  private validateType(value: any, type: string, key: string): void {
    if (!Object.values(SchemaTypes).includes(type)) {
      throw new Error(`Invalid type for ${key}`);
    }

    if (type === undefined) {
      throw new Error(`A type for ${key} must be specified`);
    }

    if (value !== undefined && value !== null) {
      if (type === 'array') {
        if (!Array.isArray(value)) {
          throw new Error(`${key} must be of type ${type}, but got ${typeof value}`);
        }
      } else if (typeof value !== type) {
        throw new Error(`${key} must be of type ${type}, but got ${typeof value}`);
      }
    }
  }

  private validateRequired(value: any, required: boolean | [boolean, string] | undefined, key: string): void {
    if (required === undefined) {
      return;
    }

    const isRequired: boolean = Array.isArray(required) ? required[0] : required;
    const error: string = Array.isArray(required) ? required[1] : '';

    if (typeof isRequired !== 'boolean') {
      throw new Error(`"required" property for ${key} must be a boolean, or an array containing a boolean as its first element`);
    }
    
    if (!isRequired || (value !== undefined && value !== null)) {
      return;
    }

    throw new Error(error || `${key} is required`);
  }

  private validateMinLength(value: any, minLength: number | [number, string] | undefined, key: string): void {
    if (minLength === undefined) {
      return;
    }

    const length: number = Array.isArray(minLength) ? minLength[0] : minLength;
    const error: string = Array.isArray(minLength) ? minLength[1] : '';

    if (typeof length !== 'number') {
      throw new Error(`"minlength" property for ${key} must be a number, or an array containing a number as its first element`);
    }

    if (typeof value === 'string' && value.length < length) {
      throw new Error(error || `${key} must be at least ${length} characters long`);
    }

    if (Array.isArray(value) && value.length < length) {
      throw new Error(error || `${key} must contain at least ${length} elements`);
    }

    if (typeof value === 'object' && Object.keys(value).length < length) {
      throw new Error(error || `${key} must contain at least ${length} properties`);
    }
  }

  private validateMaxLength(value: any, maxLength: number | [number, string] | undefined, key: string): void {
    if (maxLength === undefined) {
      return;
    }

    const length: number = Array.isArray(maxLength) ? maxLength[0] : maxLength;
    const error: string = Array.isArray(maxLength) ? maxLength[1] : '';

    if (typeof length !== 'number') {
      throw new Error(`"maxlength" property for ${key} must be a number, or an array containing a number as its first element`);
    }

    if (typeof value === 'string' && value.length > length) {
      throw new Error(error || `${key} must be at most ${length} characters long`);
    }

    if (Array.isArray(value) && value.length > length) {
      throw new Error(error || `${key} must contain at most ${length} elements`);
    }

    if (typeof value === 'object' && Object.keys(value).length > length) {
      throw new Error(error || `${key} must contain at most ${length} properties`);
    }
  }

  private validateCustom(value: any, validate: ((value: any) => boolean) | [(value: any) => boolean, string] | undefined, key: string): void {
    if (value === undefined || validate === undefined) {
      return;
    }

    if (typeof validate !== 'function' && !Array.isArray(validate)) {
      throw new Error(`"validate" property for ${key} must be a function or an array containing a function as its first element`);
    }

    const customValidate: (value: any) => boolean = Array.isArray(validate) ? validate[0] : validate;
    const error: string = Array.isArray(validate) ? validate[1] : '';

    if (typeof customValidate !== 'function') {
      throw new Error(`"validate" property for ${key} must be a function or an array containing a function as its first element`);
    }

    if (customValidate(value)) {
      return;
    }
    
    throw new Error(error || `${key} failed custom validation`);
  }

  private validateArrayTypes(value: any[], type: string | undefined, key: string): void {
    if (!Array.isArray(value) || type === undefined) {
      return;
    }

    if (value.every((i) => (typeof i === type))) {
      return;
    }

    throw new Error(`All elements in ${key} must be of type ${type}`);
  }

  private setDefault(defaultFn: (() => any), key: string): any {
    if (typeof defaultFn !== 'function'){
      throw new Error(`"default" property for ${key} must be a function`);
    }

    return defaultFn();
  }

  private doTransform(value: any, transformFn: ((value: any) => any), key: string): any {
    if (typeof transformFn !== 'function'){
      throw new Error(`"transform" property for ${key} must be a function`);
    }

    return transformFn(value);
  }

  /**
   * Validate data, comparing it against the predefined schema
   *
   * @param {T} data  Data object to validate
   * @param {SchemaDefiniton} [schema]  Schema defintion
   * @param {ValidationOptions} [options]  Validation options object
   * @return {*}  A Promise that resolves with the validated data
   * @memberof Schema
   */
  async validate(data: T, schema?: SchemaDefiniton, options?: ValidationOptions): Promise<T> {
    schema = schema ?? this.definition;
    
    // if flat dot notation data is used, deepen data object here, to be able to validate
    // against the schema
    let dataToCheck = (options && options.allowDotNotation) ? this.nestData(data) : data;

    // remove data properties which are not defined in schema (unless disabled using options)
    if (!options || !options.skipStrip) {
      this.stripData(dataToCheck, schema);
    }

    for (const key in schema) {
      const { 
        type, 
        required, 
        maxLength, 
        minLength, 
        arrayOf,
        validate: validateFn, 
        transform: transformFn, 
        default: defaultFn,
        schema: nestedSchema
      } = schema[key];

      let value = dataToCheck[key];

      // set default value if not skipped using options (only if value is undefined)
      if (!options || !options.skipDefault) {
        if (value === undefined && defaultFn !== undefined) {
          value = dataToCheck[key as keyof T] = this.setDefault(defaultFn, key);
        }
      }

      // validate required values if not skipped using options
      if (!options || !options.skipRequired) {
        this.validateRequired(value, required, key);
      }

      // validate value's type
      this.validateType(value, type, key);

      // validate value's length
      this.validateMaxLength(value, maxLength, key);
      this.validateMinLength(value, minLength, key);

      // perform custom validation
      this.validateCustom(value, validateFn, key);

      // validate array elements type
      this.validateArrayTypes(value, arrayOf, key);

      // perform transform fn (only if value isn't undefined)
      if (value !== undefined && transformFn !== undefined) {
        value = dataToCheck[key as keyof T] = this.doTransform(value, transformFn, key);
      }

      // perform function recursively, if nested schema is used
      if (nestedSchema !== undefined) {
        value = (dataToCheck[key as keyof T] as T) = await this.validate(value, nestedSchema, options);
      }
    }

    // if flat dot notation data was used and was deepened earlier, flatten data object here, 
    // back to its original form
    const dataToReturn = (options && options.allowDotNotation) ? 
      this.flattenData(dataToCheck) : dataToCheck;

    return dataToReturn;
  }
}

export default Schema;