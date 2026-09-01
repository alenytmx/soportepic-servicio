import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ADMIN_PERMISSIONS, OPERATOR_PERMISSIONS, type Permission } from '../utils/permissions.js';
import { normalizeText } from '../utils/normalize.js';

export interface IUser {
  name: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'operator';
  permissions: Permission[];
  active: boolean;
  tokenVersion: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

type UserModel = Model<IUser> & {
  hashPassword(password: string): Promise<string>;
};

const userSchema = new mongoose.Schema<IUser, UserModel>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 50 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'operator'], default: 'operator', required: true },
  permissions: [{ type: String, required: true }],
  active: { type: Boolean, default: true, index: true },
  tokenVersion: { type: Number, default: 0 },
  lastLoginAt: Date
}, { timestamps: true, versionKey: 'revision' });

userSchema.pre('validate', function () {
  this.username = normalizeText(this.username).replace(/\s/g, '');
  if (!this.permissions?.length) {
    this.permissions = this.role === 'admin' ? [...ADMIN_PERMISSIONS] : [...OPERATOR_PERMISSIONS];
  }
});

userSchema.methods.comparePassword = function (password: string) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.static('hashPassword', (password: string) => bcrypt.hash(password, 12));

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as Partial<IUser>).passwordHash;
    return ret;
  }
});

export type UserDocument = HydratedDocument<IUser>;
export const User = mongoose.model<IUser, UserModel>('User', userSchema);
