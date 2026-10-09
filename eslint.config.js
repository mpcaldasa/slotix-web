import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';
const withFiles = (configs, files) => configs.map((config) => ({ ...config, files }));
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'src/app/core/openapi.d.ts'] },
  ...withFiles(angular.configs.tsRecommended, ['src/**/*.ts']),
  ...withFiles(angular.configs.templateRecommended, ['src/**/*.html']),
  ...withFiles(angular.configs.templateAccessibility, ['src/**/*.html']),
);
