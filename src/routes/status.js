import HttpStatus from 'http-status';
import {Router} from 'express';

//****************************************************************************//
//                                                                            //
// Status router                                                              //
//                                                                            //
//****************************************************************************//


export function createStatusRouter() {
  return new Router()
    .get('/', ping);

  function ping(req, res) {
    return res.status(HttpStatus.OK).end();
  }
}