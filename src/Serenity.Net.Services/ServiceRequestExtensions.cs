﻿using Serenity.Services;
using System;
using System.Collections.Generic;

namespace Serenity.Data
{
    /// <summary>
    ///   Contains static extension methods for DbField and Meta objects.</summary>
    public static class ServiceRequestExtensions
    {
        public static TRequest IncludeField<TRequest>(this TRequest request, Field field) 
            where TRequest : ServiceRequest, IIncludeExcludeColumns
        {
            request.IncludeColumns ??= new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            request.IncludeColumns.Add(field.PropertyName ?? field.Name);
            return request;
        }
    }
}