import { useCallback, useState } from "react";
import { login as loginAgency, register, deposit, playGame } from "../api/agency";
import { refreshSessionToken } from "../api/auth";
import {
  clearGameSession,
  loadAgencyUserToken,
  loadLaunchedGameId,
  loadRefreshToken,
  saveAgencyUserToken,
  saveLaunchedGameId,
  saveRefreshToken,
} from "../lib/game-session-storage";

const DEPOSIT_AMOUNT = 10_000;

export function useAuth() {
  const [agencyUserToken, setAgencyUserToken] = useState<string>(
    () => loadAgencyUserToken() ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);

  const doLogin = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const u = username.trim();
      if (!u || !password) {
        setError("Username and password are required");
        return false;
      }
      setError(null);
      setAuthSuccessMessage(null);
      setBusy(true);
      try {
        const { token } = await loginAgency({ username: u, password });
        saveAgencyUserToken(token);
        setAgencyUserToken(token);
        return true;
      } catch (e) {
        clearGameSession();
        setAgencyUserToken("");
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const doRegister = useCallback(
    async (
      username: string,
      password: string,
      displayName: string,
    ): Promise<boolean> => {
      const u = username.trim();
      const d = displayName.trim();
      if (!u || !password || !d) {
        setError("Username, password, and display name are required");
        return false;
      }
      setError(null);
      setAuthSuccessMessage(null);
      setBusy(true);
      try {
        await register({ username: u, password, displayName: d });
        setAuthSuccessMessage("Account created successfully. Sign in to play.");
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const doLogout = useCallback(() => {
    clearGameSession();
    setAgencyUserToken("");
    setError(null);
  }, []);

  const doDeposit = useCallback(async () => {
    const token = agencyUserToken.trim();
    if (!token || depositBusy) return;
    setDepositBusy(true);
    setError(null);
    try {
      await deposit(token, { amount: String(DEPOSIT_AMOUNT) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDepositBusy(false);
    }
  }, [agencyUserToken, depositBusy]);

  const doPlayGame = useCallback(
    async (
      gameId: string,
    ): Promise<{ token: string; refreshToken: string } | null> => {
      const token = agencyUserToken.trim();
      if (!token) {
        setError("Not logged in");
        return null;
      }
      setError(null);
      setBusy(true);
      try {
        const result = await playGame(token, gameId);
        saveRefreshToken(result.refreshToken);
        saveLaunchedGameId(gameId);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [agencyUserToken],
  );

  const doRefreshAndGetToken = useCallback(async (): Promise<{
    accessToken: string;
    gameId: string;
  } | null> => {
    const rt = loadRefreshToken();
    const gid = loadLaunchedGameId();
    if (!rt || !gid) return null;
    try {
      const { accessToken, refreshToken: nextRt } =
        await refreshSessionToken(rt);
      saveRefreshToken(nextRt);
      return { accessToken, gameId: gid };
    } catch {
      clearGameSession();
      setAgencyUserToken("");
      return null;
    }
  }, []);

  return {
    agencyUserToken,
    error,
    setError,
    authSuccessMessage,
    setAuthSuccessMessage,
    busy,
    depositBusy,
    login: doLogin,
    register: doRegister,
    logout: doLogout,
    deposit: doDeposit,
    playGame: doPlayGame,
    refreshAndGetToken: doRefreshAndGetToken,
  };
}
