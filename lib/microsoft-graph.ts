/** App-only Microsoft Graph client for Teams attendance reports. */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const TOKEN_SCOPE = "https://graph.microsoft.com/.default"

type TokenCache = { accessToken: string; expiresAt: number }

let tokenCache: TokenCache | null = null

export class GraphApiError extends Error {
  status: number
  body: string

  constructor(status: number, body: string, message: string) {
    super(message)
    this.name = "GraphApiError"
    this.status = status
    this.body = body
  }
}

export function getAzureGraphConfig() {
  const tenantId = process.env.AZURE_TENANT_ID?.trim() || ""
  const clientId = process.env.AZURE_CLIENT_ID?.trim() || ""
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim() || ""
  const organizerIds = (process.env.AZURE_TEAMS_ORGANIZER_IDS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return { tenantId, clientId, clientSecret, organizerIds }
}

export function isAzureGraphConfigured() {
  const { tenantId, clientId, clientSecret } = getAzureGraphConfig()
  return Boolean(tenantId && clientId && clientSecret)
}

export async function getGraphAppToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken
  }

  const { tenantId, clientId, clientSecret } = getAzureGraphConfig()
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Teams sync is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET."
    )
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: TOKEN_SCOPE,
  })

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    throw new GraphApiError(
      res.status,
      JSON.stringify(json),
      json.error_description || json.error || "Could not get a Microsoft Graph token."
    )
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + Math.max(60, Number(json.expires_in) || 3600) * 1000,
  }
  return tokenCache.accessToken
}

export async function graphGet<T>(path: string): Promise<T> {
  const token = await getGraphAppToken()
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const text = await res.text()
  if (!res.ok) {
    throw new GraphApiError(res.status, text, graphErrorMessage(res.status, text))
  }
  if (!text) return {} as T
  return JSON.parse(text) as T
}

function graphErrorMessage(status: number, body: string) {
  let detail = body.slice(0, 400)
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } }
    detail = parsed.error?.message || parsed.error?.code || detail
  } catch {
    // keep raw
  }
  if (status === 403) {
    return (
      "Microsoft Graph refused access (403). After granting API permissions, a Teams admin must " +
      "create an Application Access Policy for this app and grant it to meeting organizers. " +
      detail
    )
  }
  if (status === 404) {
    return `Microsoft Graph could not find that meeting (404). ${detail}`
  }
  return `Microsoft Graph error ${status}: ${detail}`
}

export type TeamsJoinContext = {
  oid: string | null
  tid: string | null
  joinMeetingId: string | null
  joinUrlCandidates: string[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseTeamsJoinContext(rawUrl: string): TeamsJoinContext {
  const trimmed = rawUrl.trim()
  const candidates = new Set<string>([trimmed])

  let decoded = trimmed
  try {
    decoded = decodeURIComponent(trimmed)
    candidates.add(decoded)
  } catch {
    decoded = trimmed
  }

  let oid: string | null = null
  let tid: string | null = null
  let joinMeetingId: string | null = null

  const tryParseContext = (value: string) => {
    try {
      const parsed = JSON.parse(value) as { Oid?: string; oid?: string; Tid?: string; tid?: string }
      oid = oid || parsed.Oid || parsed.oid || null
      tid = tid || parsed.Tid || parsed.tid || null
    } catch {
      const oidMatch = value.match(/"Oid"\s*:\s*"([^"]+)"/i)
      const tidMatch = value.match(/"Tid"\s*:\s*"([^"]+)"/i)
      if (oidMatch?.[1]) oid = oid || oidMatch[1]
      if (tidMatch?.[1]) tid = tid || tidMatch[1]
    }
  }

  try {
    const url = new URL(decoded.startsWith("http") ? decoded : `https://${decoded}`)
    const context = url.searchParams.get("context")
    if (context) tryParseContext(context)
    candidates.add(`${url.origin}${url.pathname}`)
    if (url.search) candidates.add(`${url.origin}${url.pathname}${url.search}`)

    const meetMatch = url.pathname.match(/\/meet\/(\d+)/i)
    if (meetMatch?.[1]) joinMeetingId = meetMatch[1]
  } catch {
    // not a parseable URL
  }

  if (!joinMeetingId) {
    const meetMatch = decoded.match(/\/meet\/(\d+)/i)
    if (meetMatch?.[1]) joinMeetingId = meetMatch[1]
  }

  const oidMatch = decoded.match(/"Oid"\s*:\s*"([^"]+)"/i)
  const tidMatch = decoded.match(/"Tid"\s*:\s*"([^"]+)"/i)
  if (oidMatch?.[1]) oid = oid || oidMatch[1]
  if (tidMatch?.[1]) tid = tid || tidMatch[1]

  return { oid, tid, joinMeetingId, joinUrlCandidates: [...candidates] }
}

function odataEq(field: string, value: string) {
  return `${field} eq '${value.replace(/'/g, "''")}'`
}

type GraphCollection<T> = { value?: T[]; "@odata.nextLink"?: string }

export type GraphOnlineMeeting = {
  id?: string
  joinWebUrl?: string
  subject?: string
}

export type GraphAttendanceReport = {
  id?: string
  totalParticipantCount?: number
  meetingStartDateTime?: string
  meetingEndDateTime?: string
}

export type GraphAttendanceInterval = {
  durationInSeconds?: number
  joinDateTime?: string
  leaveDateTime?: string
}

export type GraphAttendanceRecord = {
  id?: string
  emailAddress?: string
  totalAttendanceInSeconds?: number
  role?: string
  identity?: {
    displayName?: string
    id?: string
    user?: { displayName?: string; id?: string }
  }
  attendanceIntervals?: GraphAttendanceInterval[]
}

export async function findOnlineMeeting(options: {
  organizerIds: string[]
  joinUrlCandidates: string[]
  joinMeetingId?: string | null
}): Promise<{ organizerId: string; meeting: GraphOnlineMeeting } | null> {
  const uniqueOrganizers = [...new Set(options.organizerIds.map((id) => id.trim()).filter(Boolean))]
  const uniqueUrls = [...new Set(options.joinUrlCandidates.filter(Boolean))]
  const joinMeetingId = options.joinMeetingId?.trim() || ""
  if (uniqueOrganizers.length === 0) return null

  const filters: string[] = []
  if (joinMeetingId) {
    filters.push(odataEq("joinMeetingIdSettings/joinMeetingId", joinMeetingId))
  }
  for (const joinUrl of uniqueUrls) {
    filters.push(odataEq("JoinWebUrl", joinUrl))
  }
  if (filters.length === 0) return null

  let lastError: unknown = null
  for (const organizerId of uniqueOrganizers) {
    for (const filter of filters) {
      const path = `/users/${encodeURIComponent(organizerId)}/onlineMeetings?$filter=${encodeURIComponent(filter)}`
      try {
        const data = await graphGet<GraphCollection<GraphOnlineMeeting>>(path)
        const meeting = data.value?.find((m) => m.id)
        if (meeting?.id) return { organizerId, meeting }
      } catch (err) {
        lastError = err
      }
    }
  }

  if (lastError) throw lastError
  return null
}

/** @deprecated use findOnlineMeeting */
export async function findOnlineMeetingByJoinUrl(
  organizerIds: string[],
  joinUrlCandidates: string[]
): Promise<{ organizerId: string; meeting: GraphOnlineMeeting } | null> {
  return findOnlineMeeting({ organizerIds, joinUrlCandidates })
}

export function organizerCandidatesFromAuthUser(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
  identities?: { provider?: string; id?: string; identity_data?: Record<string, unknown> | null }[] | null
}): string[] {
  const out: string[] = []
  const push = (value: unknown) => {
    if (typeof value !== "string") return
    const v = value.trim()
    if (!v) return
    if (UUID_RE.test(v) || v.includes("@")) out.push(v)
  }

  const meta = user.user_metadata || {}
  push(meta.oid)
  push(meta.object_id)
  push(meta.provider_id)
  if (typeof meta.sub === "string" && UUID_RE.test(meta.sub)) push(meta.sub)
  push(user.email)

  for (const ident of user.identities || []) {
    if (ident.provider && ident.provider !== "azure" && ident.provider !== "azuread") continue
    push(ident.id)
    push(ident.identity_data?.oid)
    push(ident.identity_data?.sub)
    push(ident.identity_data?.email)
  }

  return [...new Set(out)]
}

export async function listAttendanceReports(
  organizerId: string,
  meetingId: string
): Promise<GraphAttendanceReport[]> {
  const data = await graphGet<GraphCollection<GraphAttendanceReport>>(
    `/users/${encodeURIComponent(organizerId)}/onlineMeetings/${encodeURIComponent(meetingId)}/attendanceReports`
  )
  return data.value || []
}

export async function listAttendanceRecords(
  organizerId: string,
  meetingId: string,
  reportId: string
): Promise<GraphAttendanceRecord[]> {
  const out: GraphAttendanceRecord[] = []
  let next: string | undefined =
    `/users/${encodeURIComponent(organizerId)}/onlineMeetings/${encodeURIComponent(
      meetingId
    )}/attendanceReports/${encodeURIComponent(reportId)}/attendanceRecords`

  while (next) {
    const data = await graphGet<GraphCollection<GraphAttendanceRecord>>(next)
    out.push(...(data.value || []))
    next = data["@odata.nextLink"]
  }
  return out
}
