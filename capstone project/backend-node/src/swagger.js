const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Appointment Booking API',
      version: '1.0.0',
      description: 'Swagger documentation for the appointment booking platform'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: [path.join(__dirname, 'routes', '*.js')]
});

module.exports = { swaggerSpec };
