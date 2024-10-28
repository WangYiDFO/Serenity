namespace Serene.Tests;

public class TypeSourceTests
{
    [Fact]
    public void IncludesCorrectAssemblyList()
    {
        var typeSource = new AppServices.TypeSource();
        var assemblies = typeSource.GetAssemblies()
            .Select(x => x.GetName().Name);
        Assert.Collection(assemblies,
            x => Assert.Equal("Serenity.Net.Core", x),
            x => Assert.Equal("Serenity.Net.Data", x),
            x => Assert.Equal("Serenity.Net.Entity", x),
            x => Assert.Equal("Serenity.Net.Services", x),
            x => Assert.Equal("Serenity.Net.Web", x),
            x => Assert.Equal("Serenity.Extensions", x),
            x => Assert.Equal("Serenity.Demo.Northwind", x),
            x => Assert.Equal("Serenity.Demo.BasicSamples", x),
            x => Assert.Equal("Serene.Web", x));
    }
}