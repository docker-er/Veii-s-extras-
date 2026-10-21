using System.Globalization;
using Jellyfin.Plugin.Popups.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Popups.Controllers;

/// <summary>
/// What a user sends in a message.
/// </summary>
public class AskSubmitDto
{
    /// <summary>Gets or sets the kind: problem, request, opinion or other.</summary>
    public string Type { get; set; } = "other";

    /// <summary>Gets or sets what a request is for: add, subtitles, dub or other.</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>Gets or sets a typed title.</summary>
    public string TitleText { get; set; } = string.Empty;

    /// <summary>Gets or sets the attached library item id.</summary>
    public string ItemId { get; set; } = string.Empty;

    /// <summary>Gets or sets the attached item's name.</summary>
    public string ItemName { get; set; } = string.Empty;

    /// <summary>Gets or sets the attached item's type.</summary>
    public string ItemType { get; set; } = string.Empty;

    /// <summary>Gets or sets the message.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Gets or sets up to three photos as base64 JPEG (no data: prefix).</summary>
    public List<string> Images { get; set; } = new();
}

/// <summary>
/// What an admin can change on a message.
/// </summary>
public class AskUpdateDto
{
    /// <summary>Gets or sets the new status (new or done), or null to keep it.</summary>
    public string? Status { get; set; }

    /// <summary>Gets or sets the reply, or null to keep it.</summary>
    public string? Reply { get; set; }
}

/// <summary>
/// Private messages from users to the admin. A user can send and read only their own messages;
/// everything else needs an administrator.
/// </summary>
[ApiController]
[Route("Asks")]
public class AsksController : ControllerBase
{
    private const string UserIdClaim = "Jellyfin-UserId";
    private const string AdminPolicy = "RequiresElevation";
    private const int MaxImages = 3;
    private const int MaxImageBase64Chars = 4_200_000; // about 3 MB of image data

    private static readonly string[] Types = { "problem", "request", "opinion", "other" };
    private static readonly string[] Kinds = { "add", "subtitles", "dub", "other" };
    private static readonly string[] ItemTypes = { "Movie", "Series", "Season", "Episode", "BoxSet", "Audio", "MusicAlbum", "Book" };

    private readonly AsksStore _store;

    /// <summary>
    /// Initializes a new instance of the <see cref="AsksController"/> class.
    /// </summary>
    /// <param name="store">The messages store.</param>
    public AsksController(AsksStore store)
    {
        _store = store;
    }

    /// <summary>Sends a message.</summary>
    /// <param name="dto">The message.</param>
    /// <returns>The new id, or an error.</returns>
    [HttpPost]
    [Authorize]
    [RequestSizeLimit(16_000_000)]
    public ActionResult Submit([FromBody] AskSubmitDto dto)
    {
        var config = Plugin.Instance?.Configuration;
        var userId = CurrentUserId();
        if (config == null || !config.AsksEnabled || userId == null || dto == null)
        {
            return NotFound();
        }

        var message = (dto.Message ?? string.Empty).Trim();
        if (message.Length < 3 || message.Length > 2000)
        {
            return BadRequest(new { Error = "message" });
        }

        var perHour = Math.Clamp(config.AsksMaxPerHour, 1, 100);
        if (_store.CountSince(userId, DateTimeOffset.UtcNow.AddHours(-1)) >= perHour)
        {
            return StatusCode(429, new { Error = "rate" });
        }

        var images = new List<byte[]>();
        var rawImages = dto.Images ?? new List<string>();
        if (rawImages.Count > 0 && (!config.AsksAllowImages || rawImages.Count > MaxImages))
        {
            return BadRequest(new { Error = "images" });
        }

        foreach (var raw in rawImages)
        {
            if (string.IsNullOrEmpty(raw) || raw.Length > MaxImageBase64Chars)
            {
                return BadRequest(new { Error = "images" });
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(raw);
            }
            catch (FormatException)
            {
                return BadRequest(new { Error = "images" });
            }

            // Only real JPEG files are kept (the page converts every photo to JPEG before sending).
            if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 || bytes[2] != 0xFF)
            {
                return BadRequest(new { Error = "images" });
            }

            images.Add(bytes);
        }

        var itemId = string.Empty;
        if (!string.IsNullOrWhiteSpace(dto.ItemId))
        {
            if (!Guid.TryParse(dto.ItemId, out var g))
            {
                return BadRequest(new { Error = "item" });
            }

            itemId = g.ToString("N");
        }

        var entry = new AskEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            UserName = Clip(User.Identity?.Name, 100),
            CreatedUtc = DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture),
            Type = Types.Contains(dto.Type) ? dto.Type : "other",
            Kind = Kinds.Contains(dto.Kind) ? dto.Kind : string.Empty,
            TitleText = Clip(dto.TitleText, 150),
            ItemId = itemId,
            ItemName = itemId.Length > 0 ? Clip(dto.ItemName, 200) : string.Empty,
            ItemType = itemId.Length > 0 && ItemTypes.Contains(dto.ItemType) ? dto.ItemType : string.Empty,
            Message = message
        };

        _store.Add(entry, images);
        return Ok(new { entry.Id });
    }

    /// <summary>Gets the signed-in user's own messages and any replies.</summary>
    /// <returns>Only that user's messages.</returns>
    [HttpGet("Mine")]
    [Authorize]
    public ActionResult Mine()
    {
        Response.Headers["Cache-Control"] = "no-store";
        var userId = CurrentUserId();
        if (userId == null)
        {
            return Ok(Array.Empty<object>());
        }

        return Ok(_store.ForUser(userId).Select(e => new
        {
            e.Id,
            e.CreatedUtc,
            e.Type,
            e.Kind,
            e.TitleText,
            e.ItemId,
            e.ItemName,
            e.Message,
            e.Status,
            e.Reply,
            e.RepliedUtc
        }));
    }

    /// <summary>Gets every message. Administrators only.</summary>
    /// <returns>All messages, newest first.</returns>
    [HttpGet("Admin")]
    [Authorize(Policy = AdminPolicy)]
    public ActionResult All()
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(_store.All());
    }

    /// <summary>Gets a message's photos as base64 JPEG. Administrators only.</summary>
    /// <param name="id">Message id.</param>
    /// <returns>The photos.</returns>
    [HttpGet("Admin/{id}/Images")]
    [Authorize(Policy = AdminPolicy)]
    public ActionResult Images([FromRoute] string id)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (!Guid.TryParseExact(id, "N", out _))
        {
            return NotFound();
        }

        var images = _store.ReadImages(id);
        if (images == null)
        {
            return NotFound();
        }

        return Ok(new { Images = images.Select(bytes => Convert.ToBase64String(bytes)).ToList() });
    }

    /// <summary>Changes a message's status or reply. Administrators only.</summary>
    /// <param name="id">Message id.</param>
    /// <param name="dto">The changes.</param>
    /// <returns>No content.</returns>
    [HttpPost("Admin/{id}")]
    [Authorize(Policy = AdminPolicy)]
    public ActionResult Update([FromRoute] string id, [FromBody] AskUpdateDto dto)
    {
        if (!Guid.TryParseExact(id, "N", out _) || dto == null)
        {
            return NotFound();
        }

        var reply = dto.Reply == null ? null : Clip(dto.Reply.Trim(), 2000);
        return _store.Update(id, dto.Status, reply) ? NoContent() : NotFound();
    }

    /// <summary>Deletes a message. Administrators only.</summary>
    /// <param name="id">Message id.</param>
    /// <returns>No content.</returns>
    [HttpDelete("Admin/{id}")]
    [Authorize(Policy = AdminPolicy)]
    public ActionResult Remove([FromRoute] string id)
    {
        if (!Guid.TryParseExact(id, "N", out _))
        {
            return NotFound();
        }

        return _store.Delete(id) ? NoContent() : NotFound();
    }

    private static string Clip(string? text, int max)
    {
        var t = (text ?? string.Empty).Trim();
        return t.Length > max ? t.Substring(0, max) : t;
    }

    private string? CurrentUserId()
    {
        var raw = User.FindFirst(UserIdClaim)?.Value;
        return Guid.TryParse(raw, out var g) ? g.ToString("N") : null;
    }
}
