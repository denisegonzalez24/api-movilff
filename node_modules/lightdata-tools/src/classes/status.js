export class Status {

    static ok = 200;
    static created = 201;
    static noContent = 204;

    // solicitud mal formada, faltan parametros --verificartodo
    static badRequest = 400;

    // conflicto
    static conflict = 409;

    // falta token  de auth 
    static unauthorized = 401;

    // acceso denegado
    static forbidden = 403;

    //no encontrado
    static notFound = 404;

    // error inesperado servidor
    static internalServerError = 500;


}