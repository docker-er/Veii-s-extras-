using System.Globalization;
using System.Reflection;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.Popups.Configuration;
using Jellyfin.Plugin.Popups.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Popups.Controllers;

/// <summary>
/// Serves the popup script and the list of popups a signed-in user should see.
/// </summary>
[ApiController]
[Route("Popups")]
public class PopupsController : ControllerBase
{
    // Jellyfin puts these on every authenticated request (see its CustomAuthenticationHandler).
    private const string UserIdClaim = "Jellyfin-UserId";
    private const string AdminRole = "Administrator";

    private static readonly Regex ColorPattern = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);

    private readonly SeenStore _seen;
    private readonly AsksStore _asks;

    /// <summary>
    /// Initializes a new instance of the <see cref="PopupsController"/> class.
    /// </summary>
    /// <param name="seen">The seen-popups store.</param>
    /// <param name="asks">The Asks store (only used to count new messages for admins).</param>
    public PopupsController(SeenStore seen, AsksStore asks)
    {
        _seen = seen;
        _asks = asks;
    }

    /// <summary>Gets the Asks script. Public: it holds no data, only code.</summary>
    /// <returns>The script.</returns>
    [HttpGet("asks.js")]
    [AllowAnonymous]
    public ActionResult GetAsksScript() => Embedded("Jellyfin.Plugin.Popups.Web.asks.js", "text/javascript");

    /// <summary>Gets the Asks stylesheet. Public: it holds no data.</summary>
    /// <returns>The stylesheet.</returns>
    [HttpGet("asks.css")]
    [AllowAnonymous]
    public ActionResult GetAsksStyles() => Embedded("Jellyfin.Plugin.Popups.Web.asks.css", "text/css");

    /// <summary>Gets the popup script. Public: it holds no data, only code.</summary>
    /// <returns>The script.</returns>
    [HttpGet("popups.js")]
    [AllowAnonymous]
    public ActionResult GetScript() => Embedded("Jellyfin.Plugin.Popups.Web.popups.js", "text/javascript");

    /// <summary>Gets the popup stylesheet. Public: it holds no data.</summary>
    /// <returns>The stylesheet.</returns>
    [HttpGet("popups.css")]
    [AllowAnonymous]
    public ActionResult GetStyles() => Embedded("Jellyfin.Plugin.Popups.Web.popups.css", "text/css");

    /// <summary>Gets the popups the signed-in user should see right now.</summary>
    /// <returns>Settings plus the matching popups.</returns>
    [HttpGet("Active")]
    [Authorize]
    public ActionResult GetActive()
    {
        Response.Headers["Cache-Control"] = "no-store";

        var config = Plugin.Instance?.Configuration;
        var userId = CurrentUserId();
        var isAdmin = User.IsInRole(AdminRole);
        if (config == null || !config.Enabled || userId == null)
        {
            return Ok(new { Settings = Settings(config, isAdmin), Popups = Array.Empty<object>() });
        }

        var now = DateTimeOffset.UtcNow;

        var popups = config.Popups
            .Where(p => p.Enabled && !string.IsNullOrWhiteSpace(p.Id))
            .Where(p => HasContent(p))
            .Where(p => IsInWindow(p, now))
            .Where(p => MatchesAudience(p, userId, isAdmin))
            .Where(p => p.Frequency != FrequencyKind.Once || !_seen.HasSeen(userId, SeenStore.Key(p.Id, p.Revision)))
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .Select(p => new
            {
                p.Id,
                p.Revision,
                p.Label,
                p.Title,
                p.Body,
                ImageUrl = SafeUrl(p.ImageUrl),
                ItemId = p.ItemId?.Trim() ?? string.Empty,
                p.ButtonText,
                ButtonUrl = SafeUrl(p.ButtonUrl),
                p.Frequency,
                Device = p.Device is "mobile" or "desktop" ? p.Device : "all",
                Size = p.Size is "compact" or "wide" ? p.Size : "standard",
                AccentColor = ColorPattern.IsMatch(p.AccentColor ?? string.Empty) ? p.AccentColor : string.Empty
            })
            .ToList();

        return Ok(new { Settings = Settings(config, isAdmin), Popups = popups });
    }

    /// <summary>Records that the signed-in user was shown a popup.</summary>
    /// <param name="id">Popup id.</param>
    /// <param name="revision">Popup revision that was shown.</param>
    /// <returns>No content.</returns>
    [HttpPost("Seen/{id}")]
    [Authorize]
    public ActionResult MarkSeen([FromRoute] string id, [FromQuery] int revision)
    {
        var userId = CurrentUserId();
        var exists = Plugin.Instance?.Configuration.Popups.Any(p => p.Id == id) ?? false;
        if (userId == null || !exists)
        {
            return NoContent();
        }

        _seen.MarkSeen(userId, SeenStore.Key(id, revision));
        return NoContent();
    }

    private object Settings(PluginConfiguration? config, bool isAdmin)
    {
        var buttonText = (config?.AsksButtonText ?? string.Empty).Trim();
        if (buttonText.Length == 0)
        {
            buttonText = "Asks";
        }

        return new
        {
            MaxPerVisit = Math.Clamp(config?.MaxPerVisit ?? 3, 1, 20),
            ShowDelaySeconds = Math.Clamp(config?.ShowDelaySeconds ?? 1, 0, 30),
            CloseOnBackdropClick = config?.CloseOnBackdropClick ?? true,
            Asks = new
            {
                Enabled = config?.AsksEnabled ?? false,
                ShowButton = config?.AsksShowButton ?? true,
                ButtonPosition = config?.AsksButtonPosition == "bottom-left" ? "bottom-left" : "bottom-right",
                ButtonText = buttonText.Length > 24 ? buttonText.Substring(0, 24) : buttonText,
                Intro = (config?.AsksIntro ?? string.Empty).Trim(),
                AllowImages = config?.AsksAllowImages ?? true,
                NewCount = isAdmin && (config?.AsksEnabled ?? false) ? _asks.CountNew() : 0
            }
        };
    }

    private static bool HasContent(PopupDefinition p) =>
        !string.IsNullOrWhiteSpace(p.Title)
        || !string.IsNullOrWhiteSpace(p.Body)
        || !string.IsNullOrWhiteSpace(p.ImageUrl)
        || !string.IsNullOrWhiteSpace(p.ItemId);

    private static bool IsInWindow(PopupDefinition p, DateTimeOffset now)
    {
        if (TryParseUtc(p.StartsAtUtc, out var start) && now < start)
        {
            return false;
        }

        if (TryParseUtc(p.EndsAtUtc, out var end) && now > end)
        {
            return false;
        }

        return true;
    }

    private static bool TryParseUtc(string? value, out DateTimeOffset result)
    {
        result = default;
        return !string.IsNullOrWhiteSpace(value)
            && DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out result);
    }

    private static bool MatchesAudience(PopupDefinition p, string userId, bool isAdmin)
    {
        switch (p.Audience)
        {
            case AudienceKind.Admins:
                return isAdmin;
            case AudienceKind.NonAdmins:
                return !isAdmin;
            case AudienceKind.Selected:
                return p.UserIds.Any(id => Normalize(id) == userId);
            default:
                return true;
        }
    }

    private static string Normalize(string? id) =>
        Guid.TryParse(id, out var g) ? g.ToString("N") : (id ?? string.Empty).Trim().ToLowerInvariant();

    // Only web addresses, server paths and in-app routes are allowed as links or images.
    private static string SafeUrl(string? url)
    {
        var u = url?.Trim() ?? string.Empty;
        if (u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || u.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || u.StartsWith("#/", StringComparison.Ordinal)
            || (u.StartsWith('/') && !u.StartsWith("//", StringComparison.Ordinal)))
        {
            return u;
        }

        return string.Empty;
    }

    private string? CurrentUserId()
    {
        var raw = User.FindFirst(UserIdClaim)?.Value;
        return Guid.TryParse(raw, out var g) ? g.ToString("N") : null;
    }

    private ActionResult Embedded(string resourceName, string contentType)
    {
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            return NotFound();
        }

        Response.Headers["Cache-Control"] = "public, max-age=3600";
        return new FileStreamResult(stream, contentType + "; charset=utf-8");
    }
}
