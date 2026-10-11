```js
import mongoose from "mongoose";

const humanizeJobSchema = new mongoose.Schema(
  {
    halusJobId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    firebaseUid: {
      type: String,
      required: true,
      index: true
    },

    reference: {
      type: String,
      required: true,
      unique: true
    },

    status: {
      type: String,
      default: "pending"
    },

    // Number of words submitted by the user
    wordCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // Humanizer credits deducted for this job
    creditsCharged: {
      type: Number,
      default: 0,
      min: 0
    },

    // Words charged by the Halus provider
    wordsCharged: {
      type: Number,
      default: 0
    },

    resultText: {
      type: String,
      default: null
    },

    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("HumanizeJob", humanizeJobSchema);
```
