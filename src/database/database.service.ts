import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Knex from 'knex';
import knexConfig from '../../knexfile';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private knex = Knex(knexConfig.development);

    getKnex() {
        return this.knex;
    }

    async onModuleDestroy() {
        await this.knex.destroy();
    }
}