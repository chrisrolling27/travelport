export function getApiErrorMessage(error) {
  const payload = error?.payload || {};
  const details = payload?.details || {};

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof details.detail === "string" && details.detail.trim()) {
    return details.detail.trim();
  }
  if (Array.isArray(details.errors) && details.errors.length > 0) {
    const first = details.errors[0];
    const field = typeof first?.field === "string" ? first.field.trim() : "";
    const reason =
      (typeof first?.message === "string" && first.message.trim()) ||
      (typeof first?.detail === "string" && first.detail.trim()) ||
      (typeof first?.reason === "string" && first.reason.trim()) ||
      "";
    if (field && reason) return `${field}: ${reason}`;
    if (reason) return reason;
  }
  if (typeof details.title === "string" && details.title.trim()) {
    return details.title.trim();
  }
  return error?.message || "Request failed.";
}
