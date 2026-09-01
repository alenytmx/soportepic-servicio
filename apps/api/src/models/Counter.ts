import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, default: 0 }
}, { versionKey: false });

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(name: string) {
  const result = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return result.value;
}
