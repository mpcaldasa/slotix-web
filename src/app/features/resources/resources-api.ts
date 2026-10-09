import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type {
  Resource,
  ResourceInput,
  Rule,
  RuleInput,
  Block,
  BlockInput,
  Assignment,
} from '../../core/models';
@Injectable({ providedIn: 'root' })
export class ResourcesApi {
  private readonly api = inject(Api);
  private path(id = '') {
    return this.api.companyPath('/resources' + (id ? '/' + encodeURIComponent(id) : ''));
  }
  list() {
    return this.api.get<Resource[]>(this.path());
  }
  create(body: ResourceInput) {
    return this.api.post<Resource>(this.path(), body);
  }
  update(id: string, body: ResourceInput) {
    return this.api.put<Resource>(this.path(id), body);
  }
  state(id: string, action: 'activate' | 'deactivate') {
    return this.api.post<Resource>(this.path(id) + '/' + action);
  }
  remove(id: string) {
    return this.api.delete(this.path(id));
  }
  rules(id: string) {
    return this.api.get<Rule[]>(this.path(id) + '/availability-rules');
  }
  saveRule(id: string, ruleId: string | null, body: RuleInput) {
    const path = this.path(id) + '/availability-rules';
    return ruleId ? this.api.put<Rule>(path + '/' + ruleId, body) : this.api.post<Rule>(path, body);
  }
  removeRule(id: string, ruleId: string) {
    return this.api.delete(this.path(id) + '/availability-rules/' + ruleId);
  }
  blocks(id: string) {
    return this.api.get<Block[]>(this.path(id) + '/blocks');
  }
  saveBlock(id: string, blockId: string | null, body: BlockInput) {
    const path = this.path(id) + '/blocks';
    return blockId
      ? this.api.put<Block>(path + '/' + blockId, body)
      : this.api.post<Block>(path, body);
  }
  removeBlock(id: string, blockId: string) {
    return this.api.delete(this.path(id) + '/blocks/' + blockId);
  }
  assignments(id: string) {
    return this.api.get<Assignment[]>(this.path(id) + '/policies');
  }
  assign(
    id: string,
    body: { policyId: string; effectiveFrom: string; effectiveTo: string | null },
  ) {
    return this.api.post<Assignment>(this.path(id) + '/policies', body);
  }
  close(id: string, start: string, effectiveTo: string) {
    return this.api.put<Assignment>(this.assignmentPath(id, start), { effectiveTo });
  }
  replace(id: string, start: string, policyId: string) {
    return this.api.put<Assignment>(this.assignmentPath(id, start) + '/policy', { policyId });
  }
  removeAssignment(id: string, start: string) {
    return this.api.delete(this.assignmentPath(id, start));
  }
  private assignmentPath(id: string, start: string) {
    return this.path(id) + '/policies/' + encodeURIComponent(start);
  }
}
