using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Popups.Services;

/// <summary>
/// Adds one &lt;script&gt; tag to the web client's index.html as it is served.
/// Nothing is written to disk. If anything goes wrong the original page is served unchanged,
/// and the master switch in the plugin settings turns the injection off.
/// </summary>
public class IndexInjectionStartupFilter : IStartupFilter
{
    private const string Marker = "<!-- jellyfin-popups -->";
    private readonly ILogger<IndexInjectionStartupFilter> _logger;
    private int _loggedOnce;

    /// <summary>
    /// Initializes a new instance of the <see cref="IndexInjectionStartupFilter"/> class.
    /// </summary>
    /// <param name="logger">Logger.</param>
    public IndexInjectionStartupFilter(ILogger<IndexInjectionStartupFilter> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(InvokeAsync);
            next(app);
        };
    }

    private static bool IsIndexRequest(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        return path.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/web", StringComparison.OrdinalIgnoreCase);
    }

    private async Task InvokeAsync(HttpContext context, Func<Task> next)
    {
        var config = Plugin.Instance?.Configuration;
        if (!HttpMethods.IsGet(context.Request.Method)
            || !IsIndexRequest(context.Request.Path.Value)
            || config == null
            || !(config.Enabled || config.AsksEnabled))
        {
            await next().ConfigureAwait(false);
            return;
        }

        // Ask for an uncompressed, complete response so the HTML can be read and extended.
        context.Request.Headers.Remove("Accept-Encoding");
        context.Request.Headers.Remove("Range");
        context.Request.Headers.Remove("If-Range");

        var original = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next().ConfigureAwait(false);
        }
        catch
        {
            context.Response.Body = original;
            throw;
        }

        context.Response.Body = original;
        buffer.Seek(0, SeekOrigin.Begin);

        var isHtml = context.Response.StatusCode == 200
            && (context.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) ?? false);
        if (!isHtml)
        {
            await buffer.CopyToAsync(original).ConfigureAwait(false);
            return;
        }

        string html;
        using (var reader = new StreamReader(buffer, Encoding.UTF8, true, 1024, leaveOpen: true))
        {
            html = await reader.ReadToEndAsync().ConfigureAwait(false);
        }

        try
        {
            var close = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (close >= 0 && !html.Contains(Marker, StringComparison.Ordinal))
            {
                var version = Plugin.Instance?.Version?.ToString() ?? "0";
                var tag = Marker + "<script defer src=\"../Popups/popups.js?v=" + Uri.EscapeDataString(version) + "\"></script>";
                html = html.Insert(close, tag + "\n");
                if (Interlocked.Exchange(ref _loggedOnce, 1) == 0)
                {
                    _logger.LogInformation("Popups: added the popup script to the web client page");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Popups: could not extend the web page; serving it unchanged");
        }

        var bytes = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html;charset=utf-8";
        context.Response.ContentLength = bytes.Length;
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers.Remove("Accept-Ranges");
        await original.WriteAsync(bytes, 0, bytes.Length).ConfigureAwait(false);
    }
}
