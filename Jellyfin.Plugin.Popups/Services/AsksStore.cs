using System.Globalization;
using System.Text.Json;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Popups.Services;

/// <summary>
/// One message a user sent through Asks.
/// </summary>
public class AskEntry
{
    /// <summary>Gets or sets the id (a Guid in "N" format).</summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>Gets or sets the sender's user id ("N" format).</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Gets or sets the sender's name when it was sent.</summary>
    public string UserName { get; set; } = string.Empty;

    /// <summary>Gets or sets when it was sent (ISO 8601, UTC).</summary>
    public string CreatedUtc { get; set; } = string.Empty;

    /// <summary>Gets or sets the kind of message: problem, request, opinion or other.</summary>
    public string Type { get; set; } = "other";

    /// <summary>Gets or sets what a request is for: add, subtitles, dub or other.</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>Gets or sets a title typed by hand (for things not in the library).</summary>
    public string TitleText { get; set; } = string.Empty;

    /// <summary>Gets or sets the attached library item id ("N" format) or empty.</summary>
    public string ItemId { get; set; } = string.Empty;

    /// <summary>Gets or sets the attached item's name when it was sent.</summary>
    public string ItemName { get; set; } = string.Empty;

    /// <summary>Gets or sets the attached item's type (Movie, Series...).</summary>
    public string ItemType { get; set; } = string.Empty;

    /// <summary>Gets or sets the message text.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Gets or sets how many photos were attached.</summary>
    public int ImageCount { get; set; }

    /// <summary>Gets or sets the status: new or done.</summary>
    public string Status { get; set; } = "new";

    /// <summary>Gets or sets the admin's reply, shown to the sender.</summary>
    public string Reply { get; set; } = string.Empty;

    /// <summary>Gets or sets when the reply was written (ISO 8601, UTC).</summary>
    public string RepliedUtc { get; set; } = string.Empty;
}

/// <summary>
/// Keeps Asks messages and their photos on disk (data/popups/asks.json and data/popups/asks/).
/// Nothing here is ever exposed except through endpoints that check who is asking.
/// </summary>
public class AsksStore
{
    private readonly object _lock = new();
    private readonly string _file;
    private readonly string _imageDir;
    private readonly ILogger<AsksStore> _logger;
    private List<AskEntry> _entries = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="AsksStore"/> class.
    /// </summary>
    /// <param name="paths">Application paths.</param>
    /// <param name="logger">Logger.</param>
    public AsksStore(IApplicationPaths paths, ILogger<AsksStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(paths.DataPath, "popups");
        _imageDir = Path.Combine(dir, "asks");
        Directory.CreateDirectory(_imageDir);
        _file = Path.Combine(dir, "asks.json");
        Load();
    }

    /// <summary>Adds a message and saves its photos.</summary>
    /// <param name="entry">The message (its Id must already be set).</param>
    /// <param name="images">JPEG photos, already validated.</param>
    public void Add(AskEntry entry, IReadOnlyList<byte[]> images)
    {
        lock (_lock)
        {
            for (var i = 0; i < images.Count; i++)
            {
                File.WriteAllBytes(ImagePath(entry.Id, i), images[i]);
            }

            entry.ImageCount = images.Count;
            _entries.Add(entry);
            Save();
        }
    }

    /// <summary>Gets every message, newest first.</summary>
    /// <returns>A copy of the list.</returns>
    public List<AskEntry> All()
    {
        lock (_lock)
        {
            return _entries.OrderByDescending(e => e.CreatedUtc, StringComparer.Ordinal).ToList();
        }
    }

    /// <summary>Gets one user's messages, newest first.</summary>
    /// <param name="userId">User id ("N" format).</param>
    /// <returns>A copy of the list.</returns>
    public List<AskEntry> ForUser(string userId)
    {
        lock (_lock)
        {
            return _entries
                .Where(e => e.UserId == userId)
                .OrderByDescending(e => e.CreatedUtc, StringComparer.Ordinal)
                .ToList();
        }
    }

    /// <summary>Counts messages that are still new.</summary>
    /// <returns>The count.</returns>
    public int CountNew()
    {
        lock (_lock)
        {
            return _entries.Count(e => e.Status == "new");
        }
    }

    /// <summary>Counts how many messages a user sent since a moment in time.</summary>
    /// <param name="userId">User id ("N" format).</param>
    /// <param name="since">Start of the window.</param>
    /// <returns>The count.</returns>
    public int CountSince(string userId, DateTimeOffset since)
    {
        lock (_lock)
        {
            return _entries.Count(e => e.UserId == userId
                && DateTimeOffset.TryParse(e.CreatedUtc, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var t)
                && t >= since);
        }
    }

    /// <summary>Changes a message's status and/or reply.</summary>
    /// <param name="id">Message id.</param>
    /// <param name="status">New status (new or done) or null to keep.</param>
    /// <param name="reply">New reply or null to keep.</param>
    /// <returns>True if the message exists.</returns>
    public bool Update(string id, string? status, string? reply)
    {
        lock (_lock)
        {
            var entry = _entries.FirstOrDefault(e => e.Id == id);
            if (entry == null)
            {
                return false;
            }

            if (status is "new" or "done")
            {
                entry.Status = status;
            }

            if (reply != null && reply != entry.Reply)
            {
                entry.Reply = reply;
                entry.RepliedUtc = reply.Length == 0 ? string.Empty : DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture);
            }

            Save();
            return true;
        }
    }

    /// <summary>Deletes a message and its photos.</summary>
    /// <param name="id">Message id.</param>
    /// <returns>True if it existed.</returns>
    public bool Delete(string id)
    {
        lock (_lock)
        {
            var entry = _entries.FirstOrDefault(e => e.Id == id);
            if (entry == null)
            {
                return false;
            }

            for (var i = 0; i < entry.ImageCount; i++)
            {
                TryDelete(ImagePath(entry.Id, i));
            }

            _entries.Remove(entry);
            Save();
            return true;
        }
    }

    /// <summary>Reads a message's photos.</summary>
    /// <param name="id">Message id.</param>
    /// <returns>The photos (JPEG bytes), or null if the message doesn't exist.</returns>
    public List<byte[]>? ReadImages(string id)
    {
        lock (_lock)
        {
            var entry = _entries.FirstOrDefault(e => e.Id == id);
            if (entry == null)
            {
                return null;
            }

            var result = new List<byte[]>();
            for (var i = 0; i < entry.ImageCount; i++)
            {
                var path = ImagePath(entry.Id, i);
                if (File.Exists(path))
                {
                    result.Add(File.ReadAllBytes(path));
                }
            }

            return result;
        }
    }

    // Ids are only ever generated by the server as Guids, so this can't point outside the folder.
    private string ImagePath(string id, int index)
    {
        if (!Guid.TryParseExact(id, "N", out _))
        {
            throw new ArgumentException("Invalid id", nameof(id));
        }

        return Path.Combine(_imageDir, id + "-" + index.ToString(CultureInfo.InvariantCulture) + ".jpg");
    }

    private void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Asks: could not delete {Path}", path);
        }
    }

    private void Load()
    {
        try
        {
            if (File.Exists(_file))
            {
                _entries = JsonSerializer.Deserialize<List<AskEntry>>(File.ReadAllText(_file)) ?? new();
            }
        }
        catch (Exception ex)
        {
            // Do not overwrite a file we could not read: keep it aside so nothing is lost.
            _logger.LogError(ex, "Asks: could not read {File}; keeping a copy and starting empty", _file);
            try
            {
                File.Copy(_file, _file + ".broken-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture), true);
            }
            catch (Exception copyEx)
            {
                _logger.LogWarning(copyEx, "Asks: could not copy the unreadable file");
            }

            _entries = new();
        }
    }

    private void Save()
    {
        try
        {
            var temp = _file + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(_entries));
            File.Move(temp, _file, overwrite: true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Asks: could not save {File}", _file);
        }
    }
}
