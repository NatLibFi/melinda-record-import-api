
import fs from 'fs';
import path from 'path';
import {Router} from 'express';

export default function () {
  const apiDoc = fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8');

  return new Router()
    .get('/', (req, res) => {
      res.set('content-type', 'application/yaml');
      res.send(apiDoc);
    });
}
