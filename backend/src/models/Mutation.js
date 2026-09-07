import mongoose from "mongoose";

const mutationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    operationId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["processing", "completed"],
      default: "processing",
    },
    responseStatus: Number,
    responseBody: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

mutationSchema.index({ user: 1, operationId: 1 }, { unique: true });

const Mutation = mongoose.model("Mutation", mutationSchema);

export default Mutation;