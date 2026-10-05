use url::Url;

pub fn authorisation_url(
    api_base_url: &str,
    redirect_uri: &str,
    state: &str,
    connection_id: Option<&str>,
    link_identity: bool,
) -> Result<String, String> {
    let mut url = Url::parse(api_base_url).map_err(|_| "The Polychat API URL is invalid.")?;
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| "The Polychat API URL is invalid.")?;
        path.pop_if_empty().push("auth");
        if let Some(id) = connection_id {
            path.push("enterprise").push(id);
        } else {
            path.push("github");
        }
    }
    let mut query = url.query_pairs_mut();
    query.append_pair("platform", "desktop");
    query.append_pair("redirect_uri", redirect_uri);
    query.append_pair("client_state", state);
    if connection_id.is_some() && link_identity {
        query.append_pair("link", "true");
    }
    drop(query);
    Ok(url.to_string())
}
