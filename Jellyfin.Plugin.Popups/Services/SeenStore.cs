using System.Text.Json;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Popups.Services;

/// <summary>
/// Remembers, per user, which "show once" popups were already shown.
/// Stored in a small JSON file so it survives restarts and follows the user across devices.
/// </summary>
public class SeenStore
{
    private readonly object _lock = new();
    private readonly string _path;
    private readonly ILogger<SeenStore> _logger;
    private Dictionary<string, HashSet<string>> _seen = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="SeenStore"/> class.
    /// </summary>
    /// <param name="paths">Application paths.</param>
    /// <param name="logger">Logger.</param>
    public SeenStore(IApplicationPaths paths, ILogger<SeenStore> logger)
    {
        _logger = logger;
        var dir = Path.Combine(paths.DataPath, "popups");
        Directory.CreateDirectory(dir);
        _path = Path.Combine(dir, "seen.json");
        Load();
    }

    /// <summary>Builds the key used to remember one revision of one popup.</summary>
    /// <param name="popupId">Popup id.</param>
    /// <param name="revision">Popup revision.</param>
    /// <returns>The key.</returns>
    public static string Key(string popupId, int revision) => popupId + ":" + revision;

    /// <summary>Returns whether the user has already seen this popup revision.</summary>
    /// <param name="userId">Normalized user id.</param>
    /// <param name="key">Key from <see cref="Key"/>.</param>
    /// <returns>True if seen.</returns>
    public bool HasSeen(string userId, string key)
    {
        lock (_lock)
        {
            return _seen.TryGetValue(userId, out var set) && set.Contains(key);
        }
    }

    /// <summary>Records that the user saw this popup revision.</summary>
    /// <param name="userId">Normalized user id.</param>
    /// <param name="key">Key from <see cref="Key"/>.</param>
    public void MarkSeen(string userId, string key)
    {
        lock (_lock)
        {
            if (!_seen.TryGetValue(userId, out var set))
            {
                set = new HashSet<string>();
                _seen[userId] = set;
            }

            if (set.Add(key))
            {
                Save();
            }
        }
    }

    private void Load()
    {
        try
        {
            if (File.Exists(_path))
            {
                var data = JsonSerializer.Deserialize<Dictionary<string, List<string>>>(File.ReadAllText(_path));
                if (data != null)
                {
                    _seen = data.ToDictionary(kv => kv.Key, kv => new HashSet<string>(kv.Value));
                }
            }
        }
        catch (Exception ex)
        {
            // A damaged file only means "show once" popups may show one more time.
            _logger.LogWarning(ex, "Popups: could not read {Path}; starting empty", _path);
            _seen = new();
        }
    }

    private void Save()
    {
        try
        {
            var data = _seen.ToDictionary(kv => kv.Key, kv => kv.Value.ToList());
            var temp = _path + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(data));
            File.Move(temp, _path, overwrite: true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Popups: could not save {Path}", _path);
        }
    }
}
