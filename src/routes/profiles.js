
import HttpStatus from 'http-status';
import {Router} from 'express';
import bodyParser from 'body-parser';
import {profilesFactory} from '../interfaces';
import {API_URL} from '../config';
import validateContentType from '@natlibfi/express-validate-content-type';

export default function (passportMiddleware) {
  const profiles = profilesFactory({url: API_URL});

  return new Router()
    .use(passportMiddleware)
    .get('/', query)
    .get('/:id', read)
    .delete('/:id', remove)
    .put('/:id', validateContentType({type: 'application/json'}), bodyParser.json({type: 'application/json'}), createOrUpdate);

  async function query(req, res, next) {
    try {
      // Variable req.user is inserted by our own middleware and there is no chance to get injection code there
      const result = await profiles.query({user: req.user}); // njsscan-ignore: node_sqli_injection
      res.json(result);
    } catch (err) {
      return next(err);
    }
  }

  async function read(req, res, next) {
    try {
      const profile = await profiles.read({id: req.params.id, user: req.user});
      res.json(profile);
    } catch (err) {
      return next(err);
    }
  }

  async function remove(req, res, next) {
    try {
      await profiles.remove({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
  }

  async function createOrUpdate(req, res, next) {
    try {
      const sanitazedId = sanitaze(req.params.id);
      const result = await profiles.createOrUpdate({
        id: sanitazedId, user: req.user,
        payload: req.body
      });

      if (result.created) {
        res.set('Location', `${API_URL}/profiles/${sanitazedId}`);
        return res.sendStatus(HttpStatus.CREATED);
      }

      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
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
