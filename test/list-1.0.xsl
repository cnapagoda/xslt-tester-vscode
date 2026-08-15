<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>
  <xsl:template match="/">
    <books total="{count(/catalog/book)}">
      <xsl:for-each select="/catalog/book">
        <xsl:sort select="price" data-type="number" order="descending"/>
        <b><xsl:value-of select="title"/> - <xsl:value-of select="price"/></b>
      </xsl:for-each>
    </books>
  </xsl:template>
</xsl:stylesheet>
