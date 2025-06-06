"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { getAccountsFromLocalStorage, getActiveLoginIDFromLocalStorage, getToken } from "@deriv/utils"
import { AppIDConstants } from "@deriv-com/utils"

import type { TSocketRequestPayload, TSocketResponseData, TSocketSubscribableEndpointNames } from "../types"

import { useAPIContext } from "./APIProvider"
import { API_ERROR_CODES } from "./constants"
import useAPI from "./useAPI"
import useMutation from "./useMutation"

// Define the type for the context state
type AuthContextType = {
  loginIDKey?: string
  data: TSocketResponseData<"authorize"> | null | undefined
  loginid: string | null
  switchAccount: (loginid: string, forceRefresh?: boolean) => Promise<void>
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  refetch: () => void
  isFetching: boolean
  error: unknown
  isSwitching: boolean
  isInitializing: boolean
  subscribe: <T extends TSocketSubscribableEndpointNames>(
    name: T,
    payload?: TSocketRequestPayload<T>,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe: (onData: (response: any) => void) => Promise<{ unsubscribe: () => Promise<void> }>
  }
}

type LoginToken = {
  loginId: string
  token: string
}

type AuthProviderProps = {
  children: React.ReactNode
  cookieTimeout?: number
  loginIDKey?: string
  selectDefaultAccount?: (loginids: NonNullable<ReturnType<typeof getAccountsFromLocalStorage>>) => string
  logout?: () => Promise<void>
}

type TAuthorizeError = ReturnType<typeof useMutation<"authorize">>["error"]

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

function waitForLoginAndTokenWithTimeout(
  cookieTimeout = 10000,
  loginIDKey?: string,
  selectDefaultAccount?: (loginids: NonNullable<ReturnType<typeof getAccountsFromLocalStorage>>) => string,
) {
  // Default timeout of 10 seconds
  let timeoutHandle: NodeJS.Timeout | undefined,
    cookieTimeoutHandle: NodeJS.Timeout | undefined, // Handle for the cookieTimeout
    rejectFunction: (reason?: string) => void // To be used for rejecting the promise in case of a timeout or cookieTimeout expiry

  const checkLogin = (
    resolve: (value: { loginId: string; token: string }) => void,
    reject: (reason?: string) => void,
  ) => {
    const loginId = getActiveLoginIDFromLocalStorage(loginIDKey)
    const token = getToken(loginId as string)
    const storedAccounts = getAccountsFromLocalStorage()
    if (loginId && token) {
      clearTimeout(timeoutHandle) // Clear the checkLogin timeout as we've succeeded
      clearTimeout(cookieTimeoutHandle) // Clear the cookieTimeout as well
      resolve({ loginId, token })
    } else if (selectDefaultAccount && storedAccounts && Object.keys(storedAccounts).length > 0) {
      const selectedLoginId = selectDefaultAccount(storedAccounts)
      clearTimeout(timeoutHandle) // Clear the checkLogin timeout as we've succeeded
      clearTimeout(cookieTimeoutHandle) // Clear the cookieTimeout as well
      resolve({ loginId: selectedLoginId, token: getToken(selectedLoginId) || "" })
    } else {
      timeoutHandle = setTimeout(checkLogin, 100, resolve, reject)
    }
  }

  // Function to clear the timeouts and reject the promise if called
  const cleanup = () => {
    clearTimeout(timeoutHandle)
    clearTimeout(cookieTimeoutHandle)
    rejectFunction("Operation cancelled")
  }

  const promise = new Promise<LoginToken>((resolve, reject) => {
    rejectFunction = reject // Assign reject function to be accessible outside promise scope for cleanup

    // Set up the cookieTimeout to reject the promise if not resolved in time
    cookieTimeoutHandle = setTimeout(() => {
      cleanup() // Cleanup and reject the promise
      reject(new Error("Waiting for login or token timed out"))
    }, cookieTimeout)

    checkLogin(resolve, reject)
  })

  return {
    promise,
    cleanup,
  }
}

const AuthProvider = ({ loginIDKey, children, cookieTimeout, selectDefaultAccount, logout }: AuthProviderProps) => {
  const [loginid, setLoginid] = useState<string | null>(null)

  const { mutateAsync } = useMutation("authorize")

  const { queryClient, setOnReconnected, setOnConnected, wsClient, createNewWSConnection } = useAPIContext()

  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [data, setData] = useState<TSocketResponseData<"authorize"> | null>()

  const { subscribe: _subscribe } = useAPI()

  const subscribe = useCallback(
    <T extends TSocketSubscribableEndpointNames>(name: T, payload?: TSocketRequestPayload<T>) => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subscribe: (onData: (response: any) => void) => {
          return wsClient?.subscribe(name, payload, onData)
        },
      }
    },
    [wsClient, isAuthorized],
  )

  const processAuthorizeResponse = useCallback(
    (authorizeResponse: TSocketResponseData<"authorize">) => {
      setData(authorizeResponse)

      const activeLoginID = authorizeResponse.authorize?.loginid
      if (!activeLoginID) return

      setLoginid(activeLoginID)

      const accountList = authorizeResponse.authorize?.account_list
      if (!accountList) return

      const activeAccount = accountList.find((acc) => acc.loginid === activeLoginID)
      if (!activeAccount) return

      localStorage.setItem(loginIDKey ?? "active_loginid", activeLoginID)
      sessionStorage.setItem(loginIDKey ?? "active_loginid", activeLoginID)

      // Enhanced account type detection for TradeProfx
      const isDemo = activeAccount.is_virtual || /^(VRT|VRW|VRTC)/.test(activeLoginID)
      console.log(`TradeProfx AuthProvider - Account Type: ${isDemo ? "Demo" : "Real"} (LoginID: ${activeLoginID})`)

      // Store account type for UI components
      sessionStorage.setItem("account_type", isDemo ? "demo" : "real")
      localStorage.setItem("account_type", isDemo ? "demo" : "real")

      const shouldCreateNewWSConnection =
        (isDemo && wsClient?.endpoint === AppIDConstants.environments.real) ||
        (!isDemo && wsClient?.endpoint === AppIDConstants.environments.demo)
      if (shouldCreateNewWSConnection) {
        createNewWSConnection()
      }
    },
    [loginIDKey, wsClient?.endpoint, createNewWSConnection],
  )

  useEffect(() => {
    setOnConnected(() => {
      initialize()
    })
  }, [])

  useEffect(() => {
    setOnReconnected(async () => {
      setIsAuthorized(false)
      await mutateAsync({ payload: { authorize: getToken(loginid || "") ?? "" } })
      setIsAuthorized(true)
    })
  }, [loginid])

  function initialize() {
    setIsLoading(true)
    setIsInitializing(true)
    setIsSuccess(false)

    const { promise, cleanup } = waitForLoginAndTokenWithTimeout(cookieTimeout, loginIDKey, selectDefaultAccount)

    let isMounted = true

    promise
      .then(async ({ token }) => {
        setIsLoading(true)
        setIsInitializing(true)
        setIsFetching(true)
        setIsAuthorized(false)
        await mutateAsync({ payload: { authorize: token || "" } })
          .then((res) => {
            setIsAuthorized(true)
            processAuthorizeResponse(res)
            setIsLoading(false)
            setIsInitializing(false)
            setIsSuccess(true)
            setLoginid(res?.authorize?.loginid ?? "")
          })
          .catch(async (e: TAuthorizeError) => {
            if (e?.error.code === API_ERROR_CODES.DISABLED_ACCOUNT) {
              await logout?.()
            }
            setIsLoading(false)
            setIsInitializing(false)
            setIsError(true)
          })
          .finally(() => {
            setIsLoading(false)
            setIsInitializing(false)
            setIsFetching(false)
          })
      })
      .catch(() => {
        if (isMounted) {
          setIsAuthorized(false)
          setIsLoading(false)
          setIsInitializing(false)
          setIsError(true)
        }
      })

    return () => {
      isMounted = false
      cleanup()
    }
  }

  const switchAccount = useCallback(
    async (newLoginId: string, forceRefresh?: boolean) => {
      if (newLoginId === loginid && !forceRefresh) {
        return
      }
      queryClient.cancelQueries()

      setIsLoading(true)
      setIsSwitching(true)

      setIsAuthorized(false)
      try {
        const authorizeResponse = await mutateAsync({ payload: { authorize: getToken(newLoginId) ?? "" } })
        setIsAuthorized(true)
        setLoginid(newLoginId)
        processAuthorizeResponse(authorizeResponse)
      } catch (e: unknown) {
        if (typeof e === "object" && (e as TAuthorizeError)?.error.code === API_ERROR_CODES.DISABLED_ACCOUNT) {
          await logout?.()
        }
      } finally {
        setIsLoading(false)
        setIsSwitching(false)
      }
    },
    [loginid, logout, mutateAsync, processAuthorizeResponse, queryClient],
  )

  const refetch = useCallback(() => {
    switchAccount(loginid as string)
  }, [loginid, switchAccount])

  const value = useMemo(() => {
    return {
      data,
      switchAccount,
      refetch,
      isLoading,
      isError,
      isFetching,
      isSuccess: isSuccess && !isLoading,
      error: isError,
      loginid,
      isSwitching,
      isInitializing,
      subscribe,
      logout,
      createNewWSConnection,
    }
  }, [
    data,
    switchAccount,
    refetch,
    isLoading,
    isError,
    isFetching,
    isSuccess,
    loginid,
    logout,
    createNewWSConnection,
    subscribe,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider

export const useAuthContext = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuthContext must be used within APIProvider")
  }
  return context
}
