import { placeholderResponse } from "../../src/web/placeholder";

// Public read path. This Worker never gets a D1 binding (TRD decision #1).
export default {
  fetch(): Response {
    return placeholderResponse();
  },
} satisfies ExportedHandler;
