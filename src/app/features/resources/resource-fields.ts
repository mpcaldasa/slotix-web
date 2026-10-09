import type { Field } from '../../shared/editor';
import { options } from '../../shared/labels';
import type { ResourceInput } from '../../core/models';
export const resourceFields: readonly Field[] = [
  { key: 'name', label: 'Nombre', required: true, maxLength: 150 },
  { key: 'description', label: 'Descripción', type: 'textarea', maxLength: 2000 },
  {
    key: 'resourceType',
    label: 'Tipo',
    type: 'select',
    required: true,
    options: options(['SPACE', 'PERSON', 'EQUIPMENT', 'SERVICE_RESOURCE', 'OTHER']),
  },
  {
    key: 'capacity',
    label: 'Capacidad simultánea',
    type: 'number',
    required: true,
    min: 1,
    pattern: '[0-9]+',
    hint: 'Las reservas activas pueden impedir cambiar la capacidad.',
  },
  {
    key: 'visibility',
    label: 'Visibilidad',
    type: 'select',
    required: true,
    options: options(['PUBLIC', 'MEMBERS', 'PRIVATE']),
    hint: 'Privado: únicamente administradores y gestores. Todas las opciones requieren acceso a la compañía.',
  },
];
export function resourceBody(value: Record<string, string>): ResourceInput {
  return {
    name: value['name'].trim(),
    description: value['description'] || '',
    capacity: Number(value['capacity']),
    resourceType: value['resourceType'] as ResourceInput['resourceType'],
    visibility: value['visibility'] as ResourceInput['visibility'],
  };
}
