export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export type Role = 'client' | 'manager' | 'admin';
