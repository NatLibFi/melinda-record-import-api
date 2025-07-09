import fs from 'fs';
import path from 'path';
import {Router} from 'express';

export default function () {
  const apiDoc = fs.readFileSync(path.join(import.meta.dirname, '..', 'openapi.yaml'), 'utf8');

  return new Router()
    .get('/', (req, res) => {
      res.append('Access-Control-Allow-Origin', ['*']);
      res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.set('content-type', 'application/yaml');
      res.send(apiDoc);
    });
}
