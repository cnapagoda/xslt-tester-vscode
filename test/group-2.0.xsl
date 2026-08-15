<?xml version="1.0"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xsl:output method="xml" indent="yes"/>
  <xsl:template match="/">
    <report>
      <xsl:for-each-group select="/catalog/book" group-by="genre">
        <genre name="{current-grouping-key()}" count="{count(current-group())}" avg="{format-number(avg(for $b in current-group() return xs:decimal($b/price)), '#.00')}">
          <xsl:value-of select="string-join(current-group()/title, ' | ')"/>
        </genre>
      </xsl:for-each-group>
    </report>
  </xsl:template>
</xsl:stylesheet>
