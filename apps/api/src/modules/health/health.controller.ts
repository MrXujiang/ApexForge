import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      traceId: `tr_${Date.now().toString(36)}`,
      data: {
        status: 'ok',
        service: 'apexforge-api',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
