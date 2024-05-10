
import HttpStatus from 'http-status';
import {Router} from 'express';

export default function (passportMiddleware) {
  return new Router()
    .use(passportMiddleware)
    .post('/', create);

  function create(req, res) {
    const sanitazedUser = sanitaze(req.user);
    res.set('Token', sanitazedUser);
    res.sendStatus(HttpStatus.NO_CONTENT);
  }

  function sanitaze(value) {
    return value
      .replace(/\r/gu, '')
      .replace(/%0d/gu, '')
      .replace(/%0D/gu, '')
      .replace(/\n/gu, '')
      .replace(/%0a/gu, '')
      .replace(/%0A/gu, '');
  }
}
