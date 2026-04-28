import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Knex from 'knex';
import knexConfig from '../../knexfile';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private knex: Knex.Knex;

    constructor(private configService: ConfigService) {
        const env = this.configService.get<string>('NODE_ENV') || 'development';
        this.knex = Knex(knexConfig[env]);
    }

    getKnex() {
        return this.knex;
    }

    async onModuleDestroy() {
        await this.knex.destroy();
    }
}