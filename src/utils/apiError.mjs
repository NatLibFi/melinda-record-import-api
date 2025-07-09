import HttpStatus from 'http-status';

export class ApiError extends Error {
  constructor(status, message, ...params) {
    super(status, ...params);
    this.status = status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    this.message = message ?? 'Unknown error occurred';

    if (status === HttpStatus.UNAUTHORIZED) {
      this.message = 'Unauthorized';
    }

    if (status === HttpStatus.FORBIDDEN) {
      this.message = 'Forbidden';
    }

    if (status === HttpStatus.NOT_FOUND && !message) {
      this.message = 'Not found';
    }
  }
}
