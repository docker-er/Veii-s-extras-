using System.Globalization;
using Jellyfin.Plugin.Popups.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Popups;

/// <summary>
/// Popups for the Jellyfin web client: news, text, images and library items.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Application paths.</param>
    /// <param name="xmlSerializer">XML serializer.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>Gets the running plugin instance.</summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "Popups";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("88722001-51c6-43bd-af6f-1179177bbc7c");

    /// <inheritdoc />
    public override string Description => "Popups for news and announcements, plus Asks: a private inbox where users can send you problems, requests and opinions.";

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = Name,
            DisplayName = "Popups",
            EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Configuration.configPage.html", GetType().Namespace),
            EnableInMainMenu = true,
            MenuSection = "server",
            MenuIcon = "campaign"
        };

        yield return new PluginPageInfo
        {
            Name = "Asks",
            DisplayName = "Asks",
            EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Configuration.asksPage.html", GetType().Namespace),
            EnableInMainMenu = true,
            MenuSection = "server",
            MenuIcon = "forum"
        };
    }
}
