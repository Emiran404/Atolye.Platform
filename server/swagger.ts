import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Atölye.Platform API',
      version: '4.3.1',
      description: 'Atölye.Platform backend API dokümantasyonu',
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Geliştirme Sunucusu',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.ts'], // Route dosyalarındaki JSDoc yorumlarını tarar
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));
  console.log('📄 Swagger dokümantasyonu /api/docs adresinde başlatıldı');
};
