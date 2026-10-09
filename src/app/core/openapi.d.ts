// Generated from contracts/openapi.json. Do not edit.
export interface components {
  schemas: {
    UpdateResourceRequest: {
      name: string;
      description?: string;
      resourceType: 'SPACE' | 'PERSON' | 'EQUIPMENT' | 'SERVICE_RESOURCE' | 'OTHER';
      capacity?: number;
      visibility: 'PUBLIC' | 'MEMBERS' | 'PRIVATE';
    };
    ResourceResponse: {
      id?: string;
      companyId?: string;
      name?: string;
      description?: string;
      resourceType?: 'SPACE' | 'PERSON' | 'EQUIPMENT' | 'SERVICE_RESOURCE' | 'OTHER';
      capacity?: number;
      status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
      visibility?: 'PUBLIC' | 'MEMBERS' | 'PRIVATE';
      createdAt?: string;
      updatedAt?: string;
    };
    CloseResourcePolicyAssignmentRequest: { effectiveTo: string };
    ResourcePolicyResponse: {
      resourceId?: string;
      policyId?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    };
    ReplaceResourcePolicyRequest: { policyId: string };
    UpdateResourceBlockRequest: {
      startAt: string;
      endAt: string;
      reason: string;
      blockType: 'MAINTENANCE' | 'CLOSURE' | 'ADMIN_BLOCK';
    };
    ResourceBlockResponse: {
      id?: string;
      startAt?: string;
      endAt?: string;
      reason?: string;
      blockType?: 'MAINTENANCE' | 'CLOSURE' | 'ADMIN_BLOCK';
    };
    UpdateAvailabilityRuleRequest: {
      weekday?: number;
      startLocalTime: string;
      endLocalTime: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    };
    AvailabilityRuleResponse: {
      id?: string;
      weekday?: number;
      startLocalTime?: string;
      endLocalTime?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    };
    UpdateMembershipRolesRequest: {
      roles: Array<'COMPANY_ADMIN' | 'BOOKING_MANAGER' | 'CUSTOMER'>;
    };
    MembershipResponse: {
      id?: string;
      companyId?: string;
      userId?: string;
      email?: string;
      fullName?: string;
      status?: string;
      roles?: Array<'COMPANY_ADMIN' | 'BOOKING_MANAGER' | 'CUSTOMER'>;
      joinedAt?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    UpdateBookingPolicyRequest: {
      name: string;
      minDurationMinutes?: number;
      maxDurationMinutes?: number;
      slotIncrementMinutes?: number;
      minNoticeMinutes?: number;
      maxAdvanceDays?: number;
      cancellationNoticeMinutes?: number;
      approvalRequired?: boolean;
      allowCustomerCancel?: boolean;
    };
    BookingPolicyResponse: {
      id?: string;
      companyId?: string;
      name?: string;
      minDurationMinutes?: number;
      maxDurationMinutes?: number;
      slotIncrementMinutes?: number;
      minNoticeMinutes?: number;
      maxAdvanceDays?: number;
      cancellationNoticeMinutes?: number;
      approvalRequired?: boolean;
      allowCustomerCancel?: boolean;
      status?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    RescheduleBookingRequest: { startAt: string; endAt: string };
    BookingResponse: {
      id?: string;
      bookingNumber?: number;
      companyId?: string;
      resourceId?: string;
      customerUserId?: string;
      startAt?: string;
      endAt?: string;
      status?:
        | 'PENDING'
        | 'CONFIRMED'
        | 'REJECTED'
        | 'CANCELLED'
        | 'CHECKED_IN'
        | 'COMPLETED'
        | 'EXPIRED'
        | 'NO_SHOW';
      timezone?: string;
      notes?: string;
      cancelledAt?: string;
      cancellationReason?: string;
      checkedInAt?: string;
      checkedInBy?: string;
      completedAt?: string;
      completedBy?: string;
      noShowAt?: string;
      noShowBy?: string;
    };
    CreateResourceRequest: {
      name: string;
      description?: string;
      resourceType: 'SPACE' | 'PERSON' | 'EQUIPMENT' | 'SERVICE_RESOURCE' | 'OTHER';
      capacity?: number;
      visibility: 'PUBLIC' | 'MEMBERS' | 'PRIVATE';
    };
    AssignResourcePolicyRequest: { policyId: string; effectiveFrom: string; effectiveTo?: string };
    CreateResourceBlockRequest: {
      startAt: string;
      endAt: string;
      reason: string;
      blockType: 'MAINTENANCE' | 'CLOSURE' | 'ADMIN_BLOCK';
    };
    CreateAvailabilityRuleRequest: {
      weekday?: number;
      startLocalTime: string;
      endLocalTime: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    };
    AddMembershipRequest: {
      userId: string;
      roles: Array<'COMPANY_ADMIN' | 'BOOKING_MANAGER' | 'CUSTOMER'>;
    };
    CreateCompanyInvitationRequest: {
      email: string;
      roles: Array<'COMPANY_ADMIN' | 'BOOKING_MANAGER' | 'CUSTOMER'>;
    };
    CompanyInvitationResponse: {
      id?: string;
      companyId?: string;
      email?: string;
      roles?: Array<string>;
      expiresAt?: string;
      status?: string;
    };
    InitialAdministratorRequest: {
      existingUserId?: string;
      newUser?: components['schemas']['NewUserRequest'];
      singleAdministratorSpecified?: boolean;
    };
    NewUserRequest: { email: string; password: string; fullName: string };
    CompanyOnboardingResponse: {
      company?: components['schemas']['CompanyResponse'];
      administrator?: components['schemas']['MembershipResponse'];
    };
    CompanyResponse: {
      id?: string;
      legalName?: string;
      displayName?: string;
      slug?: string;
      status?: string;
      timezone?: string;
      currencyCode?: string;
      contactEmail?: string;
      createdAt?: string;
    };
    CreateBookingPolicyRequest: {
      name: string;
      minDurationMinutes?: number;
      maxDurationMinutes?: number;
      slotIncrementMinutes?: number;
      minNoticeMinutes?: number;
      maxAdvanceDays?: number;
      cancellationNoticeMinutes?: number;
      approvalRequired?: boolean;
      allowCustomerCancel?: boolean;
    };
    CompanyOnboardingRequest: {
      company: components['schemas']['CreateCompanyRequest'];
      administrator: components['schemas']['InitialAdministratorRequest'];
    };
    CreateCompanyRequest: {
      legalName: string;
      displayName: string;
      slug: string;
      contactEmail: string;
    };
    CreateBookingRequest: {
      resourceId: string;
      startAt: string;
      endAt: string;
      customerUserId?: string;
      notes?: string;
    };
    CancelBookingRequest: { reason?: string };
    RegisterUserRequest: {
      email: string;
      password: string;
      fullName: string;
      companyId: string;
      roles: Array<'COMPANY_ADMIN' | 'BOOKING_MANAGER' | 'CUSTOMER'>;
    };
    UserResponse: {
      id?: string;
      email?: string;
      fullName?: string;
      status?: string;
      createdAt?: string;
      companyId?: string;
      roles?: Array<string>;
    };
    LoginRequest: { companyId: string; email: string; password: string };
    LoginResponse: { token?: string; tokenType?: string };
    PlatformUserResponse: {
      id?: string;
      email?: string;
      fullName?: string;
      status?: string;
      platformRoles?: Array<string>;
      createdAt?: string;
      updatedAt?: string;
    };
    NotificationDeliveryResponse: {
      id?: string;
      companyId?: string;
      bookingId?: string;
      eventType?: string;
      status?: string;
      attempts?: number;
      errorCode?: string;
      nextAttemptAt?: string;
      createdAt?: string;
      sentAt?: string;
    };
    PlatformLoginRequest: { email: string; password: string };
    PasswordResetRequest: { email: string };
    PasswordResetResponse: { message?: string };
    ConfirmPasswordResetRequest: { token: string; password: string };
    AcceptCompanyInvitationRequest: { token: string; password: string; fullName: string };
    AvailabilitySlot: { startAt?: string; endAt?: string };
    MembershipPageResponse: {
      items?: Array<components['schemas']['MembershipResponse']>;
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
    };
    PlatformUserPageResponse: {
      items?: Array<components['schemas']['PlatformUserResponse']>;
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
    };
    NotificationDeliveryPageResponse: {
      items?: Array<components['schemas']['NotificationDeliveryResponse']>;
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
    };
    AuditEntryResponse: {
      id?: string;
      companyId?: string;
      actorUserId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      beforeData?: string;
      afterData?: string;
      correlationId?: string;
      createdAt?: string;
    };
    AuditPageResponse: {
      items?: Array<components['schemas']['AuditEntryResponse']>;
      page?: number;
      size?: number;
      totalElements?: number;
      totalPages?: number;
    };
  };
}
