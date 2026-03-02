export interface AdminUser {
  userId: string
  profileId: number | null
  username: string | null
  name: string | null
  email: string | null
  emailConfirmed: boolean
  newsletterSubscriber: boolean
  role: string | null
  isAdmin: boolean
  createdAt: string | null
}

export interface AdminUsersListResponse {
  users: AdminUser[]
  total: number
  page: number
  perPage: number
}

export interface AdminUserUpdatePayload {
  username: string
  name: string
  email: string
  role: string
  isAdmin: boolean
  newsletterSubscriber: boolean
}
