# Firevault
Firevault is a [Mongoose](https://mongoosejs.com/)-inspired [Firestore](https://cloud.google.com/firestore/) object modeling tool to make life easier.

## Installation
Use the package manager [npm](https://www.npmjs.com/) to install Firevault.

```bash
npm install firevault-js
```

# Importing
```javascript
// Using Node-js
const firevault = require('firevault-js');

// Using ES6 imports
import firevault from 'firevault-js';
```

# Connection
You can connect to Firevault using the [Firestore service](https://googleapis.dev/nodejs/firestore/latest/Firestore.html) imported from [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup).

```javascript
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initDB } from 'firevault-js';

initializeApp();

initDB(getFirestore());
```
```javascript
import admin from 'firebase-admin';
import { initDB } from 'firevault-js';

admin.initializeApp();

initDB(admin.firestore());
```

If needed, you can retrieve the same instance of the Firestore service using 'getDB'.

```javascript
import { getDB } from 'firevault-js';

const db = getDB();
```

# Types
Firevault supports following data types:
- **String**: string
- **Number**: number (integer or float)
- **Boolean**: boolean
- **Object**: Javascript object
- **Array**: Javascript array

# Schema
The Schema constructor has 2 parameters.

- Schema Definitions - Each Key in the schema can have the following properties:
    - type: A type from Firevault SchemaTypes.
    - required (optional): Boolean indicating if the field is required, or an Array containing a Boolean indicating if the field is required, followed by a String, which serves as the error message to display in case check fails.
    - default (optional): A Function that returns a default value.
    - validate (optional): A Function (which accepts *value* as a parameter) which returns a Boolean, or an Array of 2 values - first value is the check to be carried out (a Function which accepts *value* as a parameter), second value is a String containing an error message for when check fails.
    - maxLength (optional): A Number, or an Array of 2 values - first value is the limit, second value is a String containing an error message for when check fails.
    - minLength (optional): A Number, or an Array of 2 values - first value is the limit, second value is a String containing an error message for when check fails.
    - transform (optional): A custom method to be carried out to the parsed value.
    - schema (optional): Use this field if type is an Object, and you'd like to define its nested fields.
    - arrayOf (optional): If type is an Array, this specifies the type of values inside. **If the type is not an Array, this attribute should be omitted.**
- Methods (optional):
    - beforeSave: A method to be executed before each save to Firestore.

```javascript
import { Schema, SchemaTypes } from 'firevault-js';
import validator from 'validator';
import bcrypt from 'bcrypt';

const { String, Number, Boolean, Array } = SchemaTypes;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    transform: (value) => value.charAt(0).toUpperCase() + value.slice(1)
  },
  email: {
    type: String,
    required: [ true, 'Email address is required' ],
    validate: [ validator.isEmail, 'Please enter a valid email address' ],
    transform: (value) => value.toLowerCase()
  },
  password: {
    type: String,
    required: true
  },
  details: {
    type: Object,
    default: () => { return {} },
    schema: {
      address: {
        type: String,
        default: () => '',
        validate: [ 
          (value) => value.match('^[A-Za-z0-9]+$'), 
          'An address can only contain letters and numbers' 
        ]
      },
      skills: {
        type: Array,
        arrayOf: String,
        minLength: [ 1, 'Please enter at least 1 skill' ],
        maxLength: [ 5, 'You can only have up to 5 skills' ]
      },
      isAdmin: {
        type: Boolean,
        required: true,
        default: () => false
      }
    }
  },
  createdAt: {
    type: Number,
    default: () => Date.now()
  }
}, {
  beforeSave: async (data) => {
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }
  }
});
```

# Model
You can create a model from the schema. It requires 2 parameters.
- collection: String value for the Firestore collection
- schema: An instance of Schema.

```javascript
import { Model } from 'firevault-js';

const User = new Model("users", userSchema);
```

## **Usage**
Model object has following methods:

## create
This method creates a document in the respective Firestore collection.

**Requires**
- data: An object of the data to be stored in Firestore

**Returns**
- A promise of the data stored in the Firestore collection

```javascript
const data = await User.create({
  name: "johnny davis", 
  email: "johnny@gmail.com", 
  password: "123456",
  details: {
    skills: ["coding"]
  }
});
/*
{
  id: 'IKbgSBsj0pPsq5OyCgjU',
  name: 'Johnny Davis',
  email: 'johnny@gmail.com',   
  password: '$2a$10$FKgf3mILGVZEr6qWbhFMEOAAOjJle5EBQniqJmrs1scruRgF/i8qu', 
  details: {
    address: '',
    skills: ["coding"],
    isAdmin: false
  }       
  createdAt: 1659555047599
}
*/
```

**Optional**
- options: An object containing 4 properties
  - id: A string which can be used as an ID of the newly created document. If omitted, Firestore will automatically generate one. Defaults to *undefined*.
  - skipValidation: A boolean which can disable the validation before adding document to Firestore. Defaults to *false*.
  - skipFormatting: A boolean which can disable formatting and return the [document reference](https://firebase.google.com/docs/reference/node/firebase.firestore.DocumentReference), instead of the formatted object. Defaults to *false*.
  - skipStrip: A boolean which can disable the automatic removal of data properties which are not defined in the schema. Defaults to *false*.

```javascript
const data = await User.create({
  name: "johnny davis", 
  email: "johnny@gmail.com", 
  password: "123456",
  details: {
    skills: ["coding"]
  }
}, { id: 'custom-id', skipValidation: true });
/*
{
  id: 'custom-id',
  name: 'johnny davis',
  email: 'johnny@gmail.com',   
  password: '123456',   
  details: {
    skills: ["coding"]
  }     
}
*/
```
```javascript
const data = await User.create({
  name: "johnny davis", 
  email: "johnny@gmail.com", 
  password: "123456",
  details: {
    skills: ["coding"]
  }
}, { skipFormatting: true });
/*
{
  id: 'IKbgSBsj0pPsq5OyCgjU',
  firestore: ...,
  parent: ...,   
  path: ...,
  ...
}
*/
```

## findById
This method returns a single document from the collection.

**Requires**
- id: id of the document

**Returns**
- Promise of the data from collection

```javascript
const data = await User.findById('IKbgSBsj0pPsq5OyCgjU');
/*
{
  id: 'IKbgSBsj0pPsq5OyCgjU',
  name: 'Johnny Davis',
  email: 'johnny@gmail.com',   
  password: '$2a$10$FKgf3mILGVZEr6qWbhFMEOAAOjJle5EBQniqJmrs1scruRgF/i8qu', 
  details: {
    address: '',
    skills: ["coding"],
    isAdmin: false
  }       
  createdAt: 1659555047599
}
*/
```

**Optional**
- options: An object containing 1 property.
  - skipFormatting: A boolean which can disable the formatting and will return a single [document snapshot](https://firebase.google.com/docs/reference/node/firebase.firestore.DocumentSnapshot) from the collection, instead of the formatted object. Defaults to *false*.

```javascript
const data = await User.findById('IKbgSBsj0pPsq5OyCgjU', { skipFormatting: true });
/*
{
  id: 'IKbgSBsj0pPsq5OyCgjU',
  exists: true,
  metadata: ...,   
  ref: ...,
  ...
}
*/
```

## find
This method can be used to get one or more documents from Firestore. You can use following methods with find.
- where: Specifying conditions.
- orderBy: Ordering data by a field.
- limit: Limiting total documents returned from Firestore.
- offset: Offset on the data returned from Firestore.
- get (async): This method is required at the end of each query with find in order to execute the query. It returns a Promise with the found documents.
  - options (optional) - An object containing 1 property.
    - skipFormatting - A boolean which can disable formatting and return a [query snapshot](https://firebase.google.com/docs/reference/node/firebase.firestore.QuerySnapshot), instead of the formatted documents.
- count (async): This method returns a Promise which resolves with the [number](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) of documents which match the query.

Differtent usages of this method are as following:

```javascript
// returns all the  posts in collection
const posts = await Post.find().get();
/*
[
  {
    id: 'qXdmXL1ebnE2aAMRJLBt',
    user: { id: 'IKbgSBsj0pPsq5OyCgjU' },
    createdAt: 2022-07-20T18:17:54.456Z, 
    updatedAt: 2022-07-20T18:17:54.456Z, 
    content: 'This is a test post',      
    title: 'Hello World 2'
  },
  {
    id: 'zHsHFjSQ0MCcrIgnilN1',
    user: { id: 'NLQklOyIeP6FChAPtMck' },
    title: 'Hello World',
    createdAt: 2022-07-20T16:16:14.882Z,
    updatedAt: 2022-07-20T18:38:35.018Z,
    content: 'Updated content'
  }
]
*/
```
```javascript
// returns conditional (unformatted) data
const data = await Post
  .find()
  .where('user.id', '==', 'IKbgSBsj0pPsq5OyCgjU')
  .orderBy('createdAt', 'desc')
  .limit(2)
  .offset(1)
  .get({ skipFormatting: true });
/*
{
  docs: [{...}],
  empty: false,
  metadata: ...,   
  size: 1,
  ...
}
*/
```
```javascript
// returns number of documents matching the query
const data = await Post
  .find()
  .where('user.id', '==', 'IKbgSBsj0pPsq5OyCgjU')
  .orderBy('createdAt', 'desc')
  .count();
/*
1
*/
```

## updateById
This method can be used to update the content of an existing document in collection.

**Requires**
- id: Id of the document
- data: Data to be updated

**Returns**
- Promise of the id

```javascript
const data = await User.updateById('IKbgSBsj0pPsq5OyCgjU', { 
  email: 'johnny2@gmail.com' 
});
/*
IKbgSBsj0pPsq5OyCgjU
*/
```
```javascript
const data = await User.updateById('IKbgSBsj0pPsq5OyCgjU', { 
  'details.isAdmin': true 
});
/*
IKbgSBsj0pPsq5OyCgjU
*/
```

**Optional**
- options: An object containing a 2 property
  - skipValidation: A boolean which can disable the validation before updating document in Firestore. Defaults to *false*.
  - skipStrip: A boolean which can disable the automatic removal of data properties which are not defined in the schema. Defaults to *false*.

```javascript
const data = await User.updateById(
  'IKbgSBsj0pPsq5OyCgjU', 
  { 
    'details.skills': [] 
  }, 
  { 
    skipValidation: true 
  }
);
/*
IKbgSBsj0pPsq5OyCgjU
*/
```

## deleteById
This method can be used to delete an existing document in collection.

**Requires**
- id: Id of the document

**Returns**
- Promise of the id

```javascript
const data = await User.deleteById('IKbgSBsj0pPsq5OyCgjU');
/*
IKbgSBsj0pPsq5OyCgjU
*/
```

## validate
This method validates input data based on schema rules.

**Requires**
- data: An object of the data to be validated

**Returns**
- A promise of the validated data

```javascript
const data = await User.validate({
  isAdmin: true,
  skills: ["coding"]
});
/*
{
  isAdmin: true,
  skills: ["coding"]
}
*/
```

**Optional**
- options: An object containing 4 properties
  - skipRequired: A boolean which can skip the *required* check. Defaults to *true*.
  - skipDefault: A boolean which can skip the *default* function. Defaults to *true*.
  - skipStrip: A boolean which can disable the automatic removal of data properties which are not defined in the schema. Defaults to *false*.
  - allowDotNotation: A boolean which can allows data properties which contain dot notation (e.g. { "foo.bar": "foobar" }) to be converted to nested properties (e.g. { "foo": { "bar": "foobar" } }), check against the schema, and then convert back to dot notation strings. Defaults to *true*.

```javascript
const data = await User.validate({
  "details.bio": "Experience web developer"
});
/*
{}
*/
```
```javascript
const data = await User.validate({
  "details.bio": "Experience web developer"
}, { skipStrip: true });
/*
{
  "details.bio": "Experience web developer"
}
*/
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)