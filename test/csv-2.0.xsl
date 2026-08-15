<?xml version="1.0"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:text>title,price
</xsl:text>
    <xsl:for-each select="/catalog/book">
      <xsl:value-of select="concat(title, ',', price, '&#10;')"/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
