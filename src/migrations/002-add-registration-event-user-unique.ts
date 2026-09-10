import { QueryInterface } from 'sequelize';

interface MigrationContext {
  context: QueryInterface;
}

const CONSTRAINT_NAME = 'registrations_event_id_user_id_unique';

export async function up({ context: queryInterface }: MigrationContext) {
  await queryInterface.addConstraint('registrations', {
    fields: ['event_id', 'user_id'],
    type: 'unique',
    name: CONSTRAINT_NAME,
  });
}

export async function down({ context: queryInterface }: MigrationContext) {
  await queryInterface.removeConstraint('registrations', CONSTRAINT_NAME);
}
