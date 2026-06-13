function getOAuthResponseError(data, context, status) {
    if (!data) {
        return `${context} failed: ${status}`;
    }
    if (data.error_description) {
        return data.error_description;
    }
    if (data.error) {
        return data.error;
    }
    return `${context} failed: ${status}`;
}
