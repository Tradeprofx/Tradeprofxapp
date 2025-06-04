import { useQuery } from "@tanstack/react-query"
import initData from "../remote_config.json"

const remoteConfigQuery = async () => {
  const isProductionOrStaging = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging"
  const REMOTE_CONFIG_URL = process.env.REMOTE_CONFIG_URL || ""

  // Skip remote config fetch if URL is not set or if we're on TradeProfx domain
  if (!REMOTE_CONFIG_URL || window.location.hostname === "tradeprofxapp.pages.dev") {
    console.log("Remote Config: Using local config for TradeProfx")
    return initData
  }

  if (isProductionOrStaging && REMOTE_CONFIG_URL === "") {
    console.warn("Remote Config URL is not set, using local config")
    return initData
  }

  try {
    const response = await fetch(REMOTE_CONFIG_URL)
    if (!response.ok) {
      console.warn("Remote Config Server is out of reach, using local config")
      return initData
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("Remote Config returned non-JSON response, using local config")
      return initData
    }

    return response.json()
  } catch (error) {
    console.error("Remote Config error: ", error)
    return initData
  }
}

function useRemoteConfig() {
  return useQuery({
    queryKey: ["remoteConfig"],
    queryFn: remoteConfigQuery,
    initialData: initData,
    retry: false, // Don't retry on failure
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export default useRemoteConfig
