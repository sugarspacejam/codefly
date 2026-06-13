async function readJsonFetchResponse(response, context) {
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`${context} returned a non-JSON response`);
    }
    if (!response.ok) {
        throw new Error(getOAuthResponseError(data, context, response.status));
    }
    return data;
}
